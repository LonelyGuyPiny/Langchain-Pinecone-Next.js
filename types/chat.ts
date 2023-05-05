import { OpenAIModel } from './openai';

export interface Message {
  role: Role;
  content: string;
  source?: {
    pageContent: string,
    metadata: {
      pdf_numpages: number,
      source: string
    }
  }[];
}

export type Role = 'assistant' | 'user' | 'source';

export interface ChatBody {
  model: OpenAIModel;
  messages: Message[];
  key: string;
  prompt: string;
  question?: string;
}

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  model: OpenAIModel;
  prompt: string;
  folderId: string | null;
}
