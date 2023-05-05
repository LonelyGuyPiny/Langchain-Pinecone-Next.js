import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { PineconeClient } from '@pinecone-database/pinecone';
import { CONDENSE_PROMPT, DEFAULT_PROMPT, QA_PROMPT } from '@/utils/makechain';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
import { Message } from '@/types/chat';
import { AIChatMessage, HumanChatMessage } from 'langchain/schema';
import { ConversationChain, LLMChain, loadQAChain } from 'langchain/chains';
import { OpenAIChat } from 'langchain/llms';
import { CallbackManager } from 'langchain/callbacks';
import { DEFAULT_SYSTEM_PROMPT } from '@/utils/app/const';
import { BufferMemory, ChatMessageHistory } from 'langchain/memory';

if (!process.env.PINECONE_ENVIRONMENT || !process.env.PINECONE_API_KEY) {
    throw new Error('Pinecone environment or api key vars missing');
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    const { question, messages, key, model, prompt, settings, namespace } = req.body;
    const { temperature, maxTokenLength, topp } = settings;

    if (!question) {
        return res.status(400).json({ message: 'No question in the request' });
    }
    // OpenAI recommends replacing newlines with spaces for best results
    const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

    const pinecone = new PineconeClient();

    await pinecone.init({
        environment: process.env.PINECONE_ENVIRONMENT ?? '', //this is in the dashboard
        apiKey: process.env.PINECONE_API_KEY ?? '',
    });

    let promptToSend = prompt;
    if (!promptToSend) {
        promptToSend = DEFAULT_SYSTEM_PROMPT;
    }

    const index = pinecone.Index(PINECONE_INDEX_NAME);

    /* create vectorstore*/
    const vectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings({ openAIApiKey: key }),
        {
            pineconeIndex: index,
            textKey: 'text',
            namespace: namespace,
        },
    );

    const openModel = new OpenAIChat({
        temperature: temperature,
        openAIApiKey: key,
        // modelName: model.id, //change this to older versions (e.g. gpt-3.5-turbo) if you don't have access to gpt-4
        topP: topp,
        maxTokens: maxTokenLength
    });

    //Ask a question
    try {
        // history
        let history: any[] = messages.filter((item: Message) => item.role !== 'source').map((item: Message) => {
            if (item.role === 'user') return new HumanChatMessage(item.content);
            else return new AIChatMessage(item.content);
        });
        history.splice(history.length - 1, 1);
        let length = history.length;
        if (length > 12) {
            history = history.slice(length - 12, length - 1);
        }

        // question generator
        let newQuestion = sanitizedQuestion
        if (history.length > 0) {
            const questionGenerator = new LLMChain({
                llm: new OpenAIChat({ temperature: temperature, openAIApiKey: key, maxTokens: maxTokenLength, topP: topp }),
                prompt: CONDENSE_PROMPT,
            });

            const result = await questionGenerator.call({
                question: sanitizedQuestion,
                chat_history: history,
            });
            const keys = Object.keys(result);
            if (keys.length === 1) {
                newQuestion = result[keys[0]];
            } else {
                throw new Error("Return from llm chain has multiple values, only single values supported.");
            }
        }

        const vectorScore = await vectorStore.similaritySearchWithScore(newQuestion, 1);

        if (vectorScore.length > 0 && vectorScore[0][1] > 0.8) {
            console.log("-----------------------------------------DOC----------------------------------");
            const docChain = loadQAChain(
                openModel,
                { prompt: QA_PROMPT },
            );
            const docs = await vectorStore.asRetriever().getRelevantDocuments(newQuestion);
            const inputs = {
                question: newQuestion,
                input_documents: docs
            };
            const response = await docChain.call(inputs);
            console.log(response);
            res.status(200).json({ data: response.text });
            // sendData(JSON.stringify({ sourceDocs: docs }))
            console.log(docs);
        } else {
            console.log("-----------------------------------------OPENAI----------------------------------");
            const messageHistory = new ChatMessageHistory(history);
            const memory = new BufferMemory({
                memoryKey: "history",
                chatHistory: messageHistory
            });
            memory.chatHistory = messageHistory;
            console.log(memory);
            const conversation = new ConversationChain({
                llm: openModel,
                prompt: DEFAULT_PROMPT,
                memory: memory
            });
            const response = await conversation.call({ input: newQuestion });
            console.log(response);
            res.status(200).json({ data: response.response })
        }
    } catch (error) {
        console.log('error', error);
        res.status(500).json(error);
        return;
    }
}