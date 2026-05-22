export type ProviderTheme = "light" | "dark";

/** Provider id -> SVG filename under /public/provider/{theme}/ */
export const LLM_PROVIDER_ICONS: Record<string, string> = {
  openai: "ChatGPT.svg",
  anthropic: "anthropic.svg",
  google: "Gemini.svg",
  deepseek: "DeepSeek.svg",
  qwen: "Qwen.svg",
  kimi: "Kimi.svg",
  minimax: "MiniMax.svg",
  mistral: "Mistral AI.svg",
  azure: "azure.svg",
  zhipu: "bigmodel.svg",
  ollama: "ollama.svg",
  dashscope: "Qwen.svg",
  huggingface: "Hugging Face.svg",
};

export const LLM_PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  deepseek: "DeepSeek",
  qwen: "Qwen (DashScope)",
  kimi: "Kimi (Moonshot)",
  minimax: "MiniMax",
  mistral: "Mistral AI",
  azure: "Azure OpenAI",
  zhipu: "Zhipu AI",
  ollama: "Ollama",
  dashscope: "DashScope",
  huggingface: "HuggingFace",
};

export function resolveProviderTheme(resolvedTheme?: string | null): ProviderTheme {
  return resolvedTheme === "dark" ? "dark" : "light";
}

export function getProviderIconFilename(provider: string): string {
  return LLM_PROVIDER_ICONS[provider] ?? "ChatGPT.svg";
}

export function getProviderIconSrc(
  provider: string,
  theme: ProviderTheme
): string {
  const filename = getProviderIconFilename(provider);
  return `/provider/${theme}/${encodeURIComponent(filename)}`;
}

export function getProviderLabel(
  provider: string,
  labelFromApi?: string | null
): string {
  if (labelFromApi) return labelFromApi;
  return LLM_PROVIDER_LABELS[provider] ?? provider;
}
