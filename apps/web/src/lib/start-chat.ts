import { api } from "@/lib/api";
import { getDefaultSelection, type LlmModelsResponse } from "@/lib/llm-models";

export async function startChatWithKnowledgeBase(kb: {
  id: number;
  name: string;
}): Promise<{ id: number }> {
  const modelsData = (await api.get(
    "/api/chat/models"
  )) as LlmModelsResponse;
  const defaultModel = getDefaultSelection(modelsData);

  return api.post("/api/chat", {
    title: `Chat - ${kb.name}`,
    knowledge_base_ids: [kb.id],
    llm_config_id: defaultModel?.configId ?? undefined,
    llm_provider: defaultModel?.configId ? undefined : defaultModel?.provider,
    llm_model: defaultModel?.configId ? undefined : defaultModel?.model,
  });
}
