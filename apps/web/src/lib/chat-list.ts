import { api } from "@/lib/api";
import type { LlmModelsResponse } from "@/lib/llm-models";
import { getDefaultSelection } from "@/lib/llm-models";
import { ensureDefaultLlmOnChat } from "@/lib/chat-session";

export interface ChatSummary {
  id: string;
  title: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  knowledge_base_ids: number[];
  llm_config_id?: number | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  message_count: number;
  last_message_role?: string | null;
  last_message_preview?: string | null;
  last_message_at?: string | null;
}

export interface ChatDetail {
  id: string;
  title: string;
  knowledge_base_ids: number[];
  llm_config_id?: number | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  messages: Array<{
    id: number;
    content: string;
    role: "assistant" | "user";
    feedback?: string | null;
    created_at: string;
  }>;
}

export async function listChats(): Promise<ChatSummary[]> {
  return api.get("/api/chat") as Promise<ChatSummary[]>;
}

export async function getChatById(chatId: string): Promise<ChatDetail> {
  return api.get(`/api/chat/${chatId}`) as Promise<ChatDetail>;
}

export async function deleteChat(chatId: string): Promise<void> {
  await api.delete(`/api/chat/${chatId}`);
}

export async function createChat(params: {
  title: string;
  knowledgeBaseIds: number[];
}): Promise<ChatDetail> {
  const models = (await api.get("/api/chat/models")) as LlmModelsResponse;
  const defaultModel = getDefaultSelection(models);
  const body: Record<string, unknown> = {
    title: params.title,
    knowledge_base_ids: params.knowledgeBaseIds,
  };
  if (defaultModel?.configId != null) {
    body.llm_config_id = defaultModel.configId;
  } else if (defaultModel) {
    body.llm_provider = defaultModel.provider;
    body.llm_model = defaultModel.model;
  }
  const chat = (await api.post("/api/chat", body)) as ChatDetail;
  await ensureDefaultLlmOnChat(chat.id);
  return chat;
}
