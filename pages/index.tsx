/* eslint-disable react-hooks/exhaustive-deps */
import { Chat } from '@/components/Chat/Chat';
import { Settings } from '@/components/Chat/Settings';
import { Chatbar } from '@/components/Chatbar/Chatbar';
import { Navbar } from '@/components/Mobile/Navbar';
import { Promptbar } from '@/components/Promptbar/Promptbar';
import { Conversation, Message } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { ErrorMessage } from '@/types/error';
import { LatestExportFormat, SupportedExportFormats } from '@/types/export';
import { Folder, FolderType } from '@/types/folder';
import {
  fallbackModelID,
  OpenAIModel,
  OpenAIModelID,
  OpenAIModels,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';
import {
  cleanConversationHistory,
  cleanSelectedConversation,
} from '@/utils/app/clean';
import { DEFAULT_SYSTEM_PROMPT } from '@/utils/app/const';
import {
  saveConversation,
  saveConversations,
  updateConversation,
} from '@/utils/app/conversation';
import { saveSettings } from '@/utils/app/settings';
import { saveFolders } from '@/utils/app/folders';
import { exportData, importData } from '@/utils/app/importExport';
import { savePrompts } from '@/utils/app/prompts';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { IconArrowBarLeft, IconArrowBarRight } from '@tabler/icons-react';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { defaultSettings } from '@/config/constant';
import { PageSettings } from '@/types/settings';
import { saveNameSpace } from '@/utils/app/namespace';
import isEmpty from '@/utils/isEmpty';

interface HomeProps {
  serverSideApiKeyIsSet: boolean;
  defaultModelId: OpenAIModelID;
}

const Home: React.FC<HomeProps> = ({
  serverSideApiKeyIsSet,
  defaultModelId,
}) => {
  const { t } = useTranslation('chat');

  // STATE ----------------------------------------------

  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [lightMode, setLightMode] = useState<'dark' | 'light'>('dark');
  const [messageIsStreaming, setMessageIsStreaming] = useState<boolean>(false);

  const [modelError, setModelError] = useState<ErrorMessage | null>(null);

  const [models, setModels] = useState<OpenAIModel[]>([]);

  const [folders, setFolders] = useState<Folder[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation>();
  const [currentMessage, setCurrentMessage] = useState<Message>();

  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [showPromptbar, setShowPromptbar] = useState<boolean>(true);

  const [showSettingPage, setShowSettingPage] = useState<boolean>(false);
  const [settings, setSettings] = useState<PageSettings>(defaultSettings);
  const [namespace, setNamespace] = useState<string>('');

  const [avatar, setAvatar] = useState<string>('');

  // REFS ----------------------------------------------

  const stopConversationRef = useRef<boolean>(false);

  // FETCH RESPONSE ----------------------------------------------

  const handleSend = async (message: Message, deleteCount = 0) => {
    if (selectedConversation) {
      let updatedConversation: Conversation;

      if (deleteCount) {
        const updatedMessages = [...selectedConversation.messages];
        if (updatedMessages[updatedMessages.length - 1].role === 'source') {
          deleteCount = 3;
        }
        for (let i = 0; i < deleteCount; i++) {
          updatedMessages.pop();
        }

        updatedConversation = {
          ...selectedConversation,
          messages: [...updatedMessages, message],
        };
      } else {
        updatedConversation = {
          ...selectedConversation,
          messages: [...selectedConversation.messages, message],
        };
      }

      setSelectedConversation(updatedConversation);
      setMessageIsStreaming(true);
      setLoading(true);

      const chatbot1 = {
        question: message.content,
        messages: updatedConversation.messages,
        key: apiKey,
        model: updatedConversation.model,
        prompt: updatedConversation.prompt,
        namespace: namespace,
        settings: settings
      }

      const controller1 = new AbortController();
      const response = await fetch('/api/chat1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller1.signal,
        body: JSON.stringify(chatbot1),
      });

      if (!response.ok) {
        setLoading(false);
        setMessageIsStreaming(false);
        return;
      }

      const data = response.body;
      const result = await response.json();
      console.log(result);

      if (!data) {
        setLoading(false);
        setMessageIsStreaming(false);
        return;
      }

      setLoading(false);

      const updatedMessages: Message[] = [
        ...updatedConversation.messages,
        { role: 'assistant', content: "" },
      ];

      updatedConversation = {
        ...updatedConversation,
        messages: updatedMessages,
      };

      setSelectedConversation(updatedConversation);

      const allText: string = result.data;
      let i = 0;

      const animKey = setInterval(() => {
        if (i === allText.length) {
          if (!isEmpty(result.source)) {
            let source = result.source;
            let saveContent = '';
            source.forEach((item: { pageContent: string; }, index: any) => {
              saveContent += `Source ${index + 1}:\n\n` + item.pageContent + '\n\n';
            });
            const updatedMessages: Message[] = [
              ...updatedConversation.messages,
              { role: 'source', content: saveContent },
            ];
      
            updatedConversation = {
              ...updatedConversation,
              messages: updatedMessages,
            };

            setSelectedConversation(updatedConversation);
          }
          saveConversation(updatedConversation);

          const updatedConversations: Conversation[] = conversations.map(
            (conversation) => {
              if (conversation.id === selectedConversation.id) {
                return updatedConversation;
              }

              return conversation;
            },
          );

          if (updatedConversations.length === 0) {
            updatedConversations.push(updatedConversation);
          }

          setConversations(updatedConversations);

          saveConversations(updatedConversations);

          setMessageIsStreaming(false);

          clearInterval(animKey);
          return;
        } else if (stopConversationRef.current === true) {
          saveConversation(updatedConversation);

          const updatedConversations: Conversation[] = conversations.map(
            (conversation) => {
              if (conversation.id === selectedConversation.id) {
                return updatedConversation;
              }

              return conversation;
            },
          );

          if (updatedConversations.length === 0) {
            updatedConversations.push(updatedConversation);
          }

          setConversations(updatedConversations);

          saveConversations(updatedConversations);
          setMessageIsStreaming(false);
          clearInterval(animKey);
          return;
        } else {
          console.log(allText[i]);
          const updatedMessages: Message[] = updatedConversation.messages.map(
            (message, index) => {
              if (index === updatedConversation.messages.length - 1) {
                return {
                  ...message,
                  content: message.content + allText[i],
                };
              }

              return message;
            },
          );

          updatedConversation = {
            ...updatedConversation,
            messages: updatedMessages,
          };

          setSelectedConversation(updatedConversation);
          i++;
        }
      }, 5);
    }
  };

  // FETCH MODELS ----------------------------------------------

  const fetchModels = async (key: string) => {
    const error = {
      title: t('Error fetching models.'),
      code: null,
      messageLines: [
        t(
          'Make sure your OpenAI API key is set in the bottom left of the sidebar.',
        ),
        t('If you completed this step, OpenAI may be experiencing issues.'),
      ],
    } as ErrorMessage;

    const response = await fetch('/api/models', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
      }),
    });

    if (!response.ok) {
      try {
        const data = await response.json();
        Object.assign(error, {
          code: data.error?.code,
          messageLines: [data.error?.message],
        });
      } catch (e) {}
      setModelError(error);
      return;
    }

    const data = await response.json();

    if (!data) {
      setModelError(error);
      return;
    }

    setModels(data);
    setModelError(null);
  };

  // BASIC HANDLERS --------------------------------------------

  const handleLightMode = (mode: 'dark' | 'light') => {
    setLightMode(mode);
    localStorage.setItem('theme', mode);
  };

  const handleApiKeyChange = (apiKey: string) => {
    setApiKey(apiKey);
    localStorage.setItem('apiKey', apiKey);
  };

  const handleToggleChatbar = () => {
    setShowSidebar(!showSidebar);
    localStorage.setItem('showChatbar', JSON.stringify(!showSidebar));
  };

  const handleTogglePromptbar = () => {
    setShowPromptbar(!showPromptbar);
    localStorage.setItem('showPromptbar', JSON.stringify(!showPromptbar));
  };

  const handleExportData = () => {
    exportData();
  };

  const handleImportConversations = (data: SupportedExportFormats) => {
    const { history, folders }: LatestExportFormat = importData(data);

    setConversations(history);
    setSelectedConversation(history[history.length - 1]);
    setFolders(folders);
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    saveConversation(conversation);
  };

  const handleSettingsChange = (setting: PageSettings) => {
    setSettings(setting);
    saveSettings(setting);
  }

  // FOLDER OPERATIONS  --------------------------------------------

  const handleCreateFolder = (name: string, type: FolderType) => {
    const newFolder: Folder = {
      id: uuidv4(),
      name,
      type,
    };

    const updatedFolders = [...folders, newFolder];

    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  const handleDeleteFolder = (folderId: string) => {
    const updatedFolders = folders.filter((f) => f.id !== folderId);
    setFolders(updatedFolders);
    saveFolders(updatedFolders);

    const updatedConversations: Conversation[] = conversations.map((c) => {
      if (c.folderId === folderId) {
        return {
          ...c,
          folderId: null,
        };
      }

      return c;
    });
    setConversations(updatedConversations);
    saveConversations(updatedConversations);

    const updatedPrompts: Prompt[] = prompts.map((p) => {
      if (p.folderId === folderId) {
        return {
          ...p,
          folderId: null,
        };
      }

      return p;
    });
    setPrompts(updatedPrompts);
    savePrompts(updatedPrompts);
  };

  const handleUpdateFolder = (folderId: string, name: string) => {
    const updatedFolders = folders.map((f) => {
      if (f.id === folderId) {
        return {
          ...f,
          name,
        };
      }

      return f;
    });

    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  // CONVERSATION OPERATIONS  --------------------------------------------

  const handleNewConversation = () => {
    const lastConversation = conversations[conversations.length - 1];

    const newConversation: Conversation = {
      id: uuidv4(),
      name: `${t('New Conversation')}`,
      messages: [],
      model: lastConversation?.model || {
        id: OpenAIModels[defaultModelId].id,
        name: OpenAIModels[defaultModelId].name,
        maxLength: OpenAIModels[defaultModelId].maxLength,
        tokenLimit: OpenAIModels[defaultModelId].tokenLimit,
      },
      prompt: DEFAULT_SYSTEM_PROMPT,
      folderId: null,
    };

    const updatedConversations = [...conversations, newConversation];

    setSelectedConversation(newConversation);
    setConversations(updatedConversations);

    saveConversation(newConversation);
    saveConversations(updatedConversations);

    setLoading(false);
  };

  const handleDeleteConversation = (conversation: Conversation) => {
    const updatedConversations = conversations.filter(
      (c) => c.id !== conversation.id,
    );
    setConversations(updatedConversations);
    saveConversations(updatedConversations);

    if (updatedConversations.length > 0) {
      setSelectedConversation(
        updatedConversations[updatedConversations.length - 1],
      );
      saveConversation(updatedConversations[updatedConversations.length - 1]);
    } else {
      setSelectedConversation({
        id: uuidv4(),
        name: 'New conversation',
        messages: [],
        model: OpenAIModels[defaultModelId],
        prompt: DEFAULT_SYSTEM_PROMPT,
        folderId: null,
      });
      localStorage.removeItem('selectedConversation');
    }
  };

  const handleUpdateConversation = (
    conversation: Conversation,
    data: KeyValuePair,
  ) => {
    const updatedConversation = {
      ...conversation,
      [data.key]: data.value,
    };

    const { single, all } = updateConversation(
      updatedConversation,
      conversations,
    );

    setSelectedConversation(single);
    setConversations(all);
  };

  const handleClearConversations = () => {
    setConversations([]);
    localStorage.removeItem('conversationHistory');

    setSelectedConversation({
      id: uuidv4(),
      name: 'New conversation',
      messages: [],
      model: OpenAIModels[defaultModelId],
      prompt: DEFAULT_SYSTEM_PROMPT,
      folderId: null,
    });
    localStorage.removeItem('selectedConversation');

    const updatedFolders = folders.filter((f) => f.type !== 'chat');
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
  };

  const handleEditMessage = (message: Message, messageIndex: number) => {
    if (selectedConversation) {
      const updatedMessages = selectedConversation.messages
        .map((m, i) => {
          if (i < messageIndex) {
            return m;
          }
        })
        .filter((m) => m) as Message[];

      const updatedConversation = {
        ...selectedConversation,
        messages: updatedMessages,
      };

      const { single, all } = updateConversation(
        updatedConversation,
        conversations,
      );

      setSelectedConversation(single);
      setConversations(all);

      setCurrentMessage(message);
    }
  };

  // PROMPT OPERATIONS --------------------------------------------

  const handleCreatePrompt = () => {
    const lastPrompt = prompts[prompts.length - 1];

    const newPrompt: Prompt = {
      id: uuidv4(),
      name: `Prompt ${prompts.length + 1}`,
      description: '',
      content: '',
      model: OpenAIModels[defaultModelId],
      folderId: null,
    };

    const updatedPrompts = [...prompts, newPrompt];

    setPrompts(updatedPrompts);
    savePrompts(updatedPrompts);
  };

  const handleUpdatePrompt = (prompt: Prompt) => {
    const updatedPrompts = prompts.map((p) => {
      if (p.id === prompt.id) {
        return prompt;
      }

      return p;
    });

    setPrompts(updatedPrompts);
    savePrompts(updatedPrompts);
  };

  const handleDeletePrompt = (prompt: Prompt) => {
    const updatedPrompts = prompts.filter((p) => p.id !== prompt.id);
    setPrompts(updatedPrompts);
    savePrompts(updatedPrompts);
  };

  const handleChatSettings = (e: boolean) => {
    ////////////////////////////////////////////////////////////////////////////////////////////
    setShowSettingPage(e);
  }

  // EFFECTS  --------------------------------------------

  useEffect(() => {
    if (currentMessage) {
      handleSend(currentMessage);
      setCurrentMessage(undefined);
    }
  }, [currentMessage]);

  useEffect(() => {
    if (window.innerWidth < 640) {
      setShowSidebar(false);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (apiKey) {
      fetchModels(apiKey);
    }
  }, [apiKey]);

  // ON LOAD --------------------------------------------

  useEffect(() => {
    const setting = localStorage.getItem('settings');
    if (!setting) {
      saveSettings(defaultSettings);
      setSettings(defaultSettings);
    } else {
      setSettings(JSON.parse(setting));
    }

    const pinename = localStorage.getItem('namespace');
    if (!pinename) {
      const name = uuidv4();
      saveNameSpace(name);
      setNamespace(name);
    } else {
      setNamespace(pinename);
    }

    const theme = localStorage.getItem('theme');
    if (theme) {
      setLightMode(theme as 'dark' | 'light');
    }

    const apiKey = localStorage.getItem('apiKey');
    if (apiKey) {
      setApiKey(apiKey);
      fetchModels(apiKey);
    } else if (serverSideApiKeyIsSet) {
      fetchModels('');
    }

    if (window.innerWidth < 640) {
      setShowSidebar(false);
    }

    const showChatbar = localStorage.getItem('showChatbar');
    if (showChatbar) {
      setShowSidebar(showChatbar === 'true');
    }

    const showPromptbar = localStorage.getItem('showPromptbar');
    if (showPromptbar) {
      setShowPromptbar(showPromptbar === 'true');
    }

    const folders = localStorage.getItem('folders');
    if (folders) {
      setFolders(JSON.parse(folders));
    }

    const prompts = localStorage.getItem('prompts');
    if (prompts) {
      setPrompts(JSON.parse(prompts));
    }

    const conversationHistory = localStorage.getItem('conversationHistory');
    if (conversationHistory) {
      const parsedConversationHistory: Conversation[] =
        JSON.parse(conversationHistory);
      const cleanedConversationHistory = cleanConversationHistory(
        parsedConversationHistory,
      );
      setConversations(cleanedConversationHistory);
    }

    const selectedConversation = localStorage.getItem('selectedConversation');
    if (selectedConversation) {
      const parsedSelectedConversation: Conversation =
        JSON.parse(selectedConversation);
      const cleanedSelectedConversation = cleanSelectedConversation(
        parsedSelectedConversation,
      );
      setSelectedConversation(cleanedSelectedConversation);
    } else {
      setSelectedConversation({
        id: uuidv4(),
        name: 'New conversation',
        messages: [],
        model: OpenAIModels[defaultModelId],
        prompt: DEFAULT_SYSTEM_PROMPT,
        folderId: null,
      });
    }
  }, [serverSideApiKeyIsSet]);

  useEffect(() => {
    if (stopConversationRef.current === true) {
      console.log('2');
    }
  }, [stopConversationRef.current]);

  return (
    <>
      <Head>
        <title>Chatbot</title>
        <meta name="description" content="Chris's chatbot" />
        <meta
          name="viewport"
          content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
        />
        <link rel="icon" href="/title.png" />
      </Head>
      {selectedConversation && (
        <main
          className={`flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode}`}
        >
          <div className="fixed top-0 w-full sm:hidden">
            <Navbar
              selectedConversation={selectedConversation}
              onNewConversation={handleNewConversation}
            />
          </div>

          <div className="flex h-full w-full pt-[48px] sm:pt-0">
            {showSidebar ? (
              <div>
                <Chatbar
                  loading={messageIsStreaming}
                  conversations={conversations}
                  lightMode={lightMode}
                  selectedConversation={selectedConversation}
                  apiKey={apiKey}
                  folders={folders.filter((folder) => folder.type === 'chat')}
                  onToggleLightMode={handleLightMode}
                  onCreateFolder={(name) => handleCreateFolder(name, 'chat')}
                  onDeleteFolder={handleDeleteFolder}
                  onUpdateFolder={handleUpdateFolder}
                  onNewConversation={handleNewConversation}
                  onSelectConversation={handleSelectConversation}
                  onDeleteConversation={handleDeleteConversation}
                  onToggleSidebar={handleToggleChatbar}
                  onUpdateConversation={handleUpdateConversation}
                  onApiKeyChange={handleApiKeyChange}
                  onClearConversations={handleClearConversations}
                  onExportConversations={handleExportData}
                  onImportConversations={handleImportConversations}
                  onChatSettings={handleChatSettings}
                />

                <button
                  className="fixed top-5 left-[270px] z-50 h-7 w-7 hover:text-gray-400 dark:text-white dark:hover:text-gray-300 sm:top-0.5 sm:left-[270px] sm:h-8 sm:w-8 sm:text-neutral-700"
                  onClick={handleToggleChatbar}
                >
                  <IconArrowBarLeft />
                </button>
                <div
                  onClick={handleToggleChatbar}
                  className="absolute top-0 left-0 z-10 h-full w-full bg-black opacity-70 sm:hidden"
                ></div>
              </div>
            ) : (
              <button
                className="fixed top-2.5 left-4 z-50 h-7 w-7 text-white hover:text-gray-400 dark:text-white dark:hover:text-gray-300 sm:top-0.5 sm:left-4 sm:h-8 sm:w-8 sm:text-neutral-700"
                onClick={handleToggleChatbar}
              >
                <IconArrowBarRight />
              </button>
            )}

            <div className="flex flex-1">
              {
                showSettingPage ? 
                  <Settings
                    settings={settings}
                    onToChatPage={handleChatSettings}
                    setSettings={handleSettingsChange}
                    namespace={namespace}
                    showSettingPage={showSettingPage}
                    key={apiKey}
                  /> :
                  <Chat
                    avatar={settings.avatar?.response.url}
                    conversation={selectedConversation}
                    messageIsStreaming={messageIsStreaming}
                    apiKey={apiKey}
                    serverSideApiKeyIsSet={serverSideApiKeyIsSet}
                    defaultModelId={defaultModelId}
                    modelError={modelError}
                    models={models}
                    loading={loading}
                    prompts={prompts}
                    onSend={handleSend}
                    onUpdateConversation={handleUpdateConversation}
                    onEditMessage={handleEditMessage}
                    stopConversationRef={stopConversationRef}
                  />
              }
            </div>

            {showPromptbar ? (
              <div>
                <Promptbar
                  prompts={prompts}
                  folders={folders.filter((folder) => folder.type === 'prompt')}
                  onToggleSidebar={handleTogglePromptbar}
                  onCreatePrompt={handleCreatePrompt}
                  onUpdatePrompt={handleUpdatePrompt}
                  onDeletePrompt={handleDeletePrompt}
                  onCreateFolder={(name) => handleCreateFolder(name, 'prompt')}
                  onDeleteFolder={handleDeleteFolder}
                  onUpdateFolder={handleUpdateFolder}
                />
                <button
                  className="fixed top-5 right-[270px] z-50 h-7 w-7 hover:text-gray-400 dark:text-white dark:hover:text-gray-300 sm:top-0.5 sm:right-[270px] sm:h-8 sm:w-8 sm:text-neutral-700"
                  onClick={handleTogglePromptbar}
                >
                  <IconArrowBarRight />
                </button>
                <div
                  onClick={handleTogglePromptbar}
                  className="absolute top-0 left-0 z-10 h-full w-full bg-black opacity-70 sm:hidden"
                ></div>
              </div>
            ) : (
              <button
                className="fixed top-2.5 right-4 z-50 h-7 w-7 text-white hover:text-gray-400 dark:text-white dark:hover:text-gray-300 sm:top-0.5 sm:right-4 sm:h-8 sm:w-8 sm:text-neutral-700"
                onClick={handleTogglePromptbar}
              >
                <IconArrowBarLeft />
              </button>
            )}
          </div>
        </main>
      )}
    </>
  );
};
export default Home;

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
  const defaultModelId =
    (process.env.DEFAULT_MODEL &&
      Object.values(OpenAIModelID).includes(
        process.env.DEFAULT_MODEL as OpenAIModelID,
      ) &&
      process.env.DEFAULT_MODEL) ||
    fallbackModelID;

  return {
    props: {
      serverSideApiKeyIsSet: !!process.env.OPENAI_API_KEY,
      defaultModelId,
      ...(await serverSideTranslations(locale ?? 'en', [
        'common',
        'chat',
        'sidebar',
        'markdown',
        'promptbar',
      ])),
    },
  };
};
