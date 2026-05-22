import { api } from "@/lib/api";
import { getDefaultSelection, type LlmModelsResponse } from "@/lib/llm-models";

export interface WorkspaceChat {
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
    created_at: string;
  }>;
}

/** Load or create the user's single workspace conversation. */
export async function loadWorkspaceChat(): Promise<WorkspaceChat> {
  return api.get("/api/chat/workspace") as Promise<WorkspaceChat>;
}

/** Load a conversation by id (full message history). */
export async function loadChatById(chatId: string): Promise<WorkspaceChat> {
  return api.get(`/api/chat/${chatId}`) as Promise<WorkspaceChat>;
}

export async function updateWorkspaceKnowledgeBases(
  chatId: string,
  knowledgeBaseIds: number[]
): Promise<void> {
  await api.patch(`/api/chat/${chatId}`, {
    knowledge_base_ids: knowledgeBaseIds,
  });
}

export async function applyKnowledgeBasesFromQuery(
  chatId: string,
  kbIds: number[]
): Promise<void> {
  if (kbIds.length === 0) return;
  await updateWorkspaceKnowledgeBases(chatId, kbIds);
}

export async function ensureDefaultLlmOnChat(chatId: string): Promise<void> {
  const models = (await api.get("/api/chat/models")) as LlmModelsResponse;
  const defaultModel = getDefaultSelection(models);
  if (!defaultModel) return;
  await api.patch(`/api/chat/${chatId}`, {
    llm_config_id: defaultModel.configId ?? null,
    llm_provider: defaultModel.configId ? null : defaultModel.provider,
    llm_model: defaultModel.configId ? null : defaultModel.model,
  });
}

export function parseKbIdsFromSearchParams(
  searchParams: URLSearchParams
): number[] {
  const raw =
    searchParams.get("kb_ids") ?? searchParams.get("kb_id") ?? "";
  if (!raw.trim()) return [];
  const ids = new Set<number>();
  for (const part of raw.split(",")) {
    const n = Number.parseInt(part.trim(), 10);
    if (Number.isFinite(n) && n > 0) ids.add(n);
  }
  return [...ids];
}
