import { api } from "@/lib/api";
import type {
  ApiMessageRetrieval,
  ApiMessageSource,
} from "@/lib/chat-retrieval-stream";
import { getDefaultSelection, type LlmModelsResponse } from "@/lib/llm-models";

export interface WorkspaceChat {
  uuid: string;
  title: string;
  knowledge_base_uuids: string[];
  llm_config_id?: number | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  messages: Array<{
    id: number;
    content: string;
    role: "assistant" | "user";
    created_at: string;
    retrieval?: ApiMessageRetrieval | null;
    sources?: ApiMessageSource[];
  }>;
}

/** Load or create the user's single workspace conversation. */
export async function loadWorkspaceChat(): Promise<WorkspaceChat> {
  return api.get("/api/chat/workspace") as Promise<WorkspaceChat>;
}

/** Load a conversation by uuid (full message history). */
export async function loadChatById(chatUuid: string): Promise<WorkspaceChat> {
  return api.get(`/api/chat/${chatUuid}`) as Promise<WorkspaceChat>;
}

export async function updateWorkspaceKnowledgeBases(
  chatUuid: string,
  knowledgeBaseUuids: string[]
): Promise<void> {
  await api.patch(`/api/chat/${chatUuid}`, {
    knowledge_base_uuids: knowledgeBaseUuids,
  });
}

export async function applyKnowledgeBasesFromQuery(
  chatUuid: string,
  kbUuids: string[]
): Promise<void> {
  if (kbUuids.length === 0) return;
  await updateWorkspaceKnowledgeBases(chatUuid, kbUuids);
}

export async function ensureDefaultLlmOnChat(chatUuid: string): Promise<void> {
  const models = (await api.get("/api/chat/models")) as LlmModelsResponse;
  const defaultModel = getDefaultSelection(models);
  if (!defaultModel) return;
  await api.patch(`/api/chat/${chatUuid}`, {
    llm_config_id: defaultModel.configId ?? null,
    llm_provider: defaultModel.configId ? null : defaultModel.provider,
    llm_model: defaultModel.configId ? null : defaultModel.model,
  });
}

export function parseKbUuidsFromSearchParams(
  searchParams: URLSearchParams
): string[] {
  const raw =
    searchParams.get("kb_uuids") ?? searchParams.get("kb_uuid") ?? "";
  if (!raw.trim()) return [];
  const uuids = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (trimmed) uuids.add(trimmed);
  }
  return [...uuids];
}
