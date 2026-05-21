export interface LlmModelOption {
  provider: string;
  model: string;
  label: string;
  is_default?: boolean;
  config_id?: number | null;
}

export interface LlmProviderOption {
  provider: string;
  label: string;
  models: LlmModelOption[];
}

export interface LlmModelsResponse {
  providers: LlmProviderOption[];
  default_provider: string;
  default_model: string;
  default_config_id?: number | null;
}

export interface LlmSelection {
  configId?: number | null;
  provider: string;
  model: string;
}

const MODEL_VALUE_SEPARATOR = "::";
const CONFIG_VALUE_PREFIX = "config:";

export function encodeModelValue(selection: LlmSelection): string {
  if (selection.configId != null) {
    return `${CONFIG_VALUE_PREFIX}${selection.configId}`;
  }
  return `${selection.provider}${MODEL_VALUE_SEPARATOR}${selection.model}`;
}

export function decodeModelValue(value: string): LlmSelection | null {
  if (value.startsWith(CONFIG_VALUE_PREFIX)) {
    const configId = Number(value.slice(CONFIG_VALUE_PREFIX.length));
    if (!Number.isFinite(configId)) return null;
    return { configId, provider: "", model: "" };
  }

  const separatorIndex = value.indexOf(MODEL_VALUE_SEPARATOR);
  if (separatorIndex <= 0) return null;
  return {
    provider: value.slice(0, separatorIndex),
    model: value.slice(separatorIndex + MODEL_VALUE_SEPARATOR.length),
  };
}

export function findModelLabel(
  providers: LlmProviderOption[],
  selection: LlmSelection
): string {
  if (selection.configId != null) {
    for (const provider of providers) {
      const match = provider.models.find(
        (item) => item.config_id === selection.configId
      );
      if (match) return match.label;
    }
    return selection.model || String(selection.configId);
  }

  const providerOption = providers.find(
    (item) => item.provider === selection.provider
  );
  const modelOption = providerOption?.models.find(
    (item) => item.model === selection.model
  );
  if (modelOption) return modelOption.label;
  return selection.model;
}

export function getDefaultSelection(data: LlmModelsResponse): LlmSelection {
  if (data.default_config_id != null) {
    return {
      configId: data.default_config_id,
      provider: data.default_provider,
      model: data.default_model,
    };
  }
  return {
    provider: data.default_provider,
    model: data.default_model,
  };
}

export function selectionFromProviders(
  providers: LlmProviderOption[],
  selection: LlmSelection
): LlmSelection {
  if (selection.configId != null) {
    for (const provider of providers) {
      const match = provider.models.find(
        (item) => item.config_id === selection.configId
      );
      if (match) {
        return {
          configId: match.config_id,
          provider: match.provider,
          model: match.model,
        };
      }
    }
  }
  return selection;
}
