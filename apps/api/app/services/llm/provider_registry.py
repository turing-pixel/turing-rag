from dataclasses import dataclass

OPENAI_COMPATIBLE_PROVIDERS = frozenset(
    {
        "anthropic",
        "google",
        "qwen",
        "kimi",
        "mistral",
        "azure",
        "zhipu",
    }
)


@dataclass(frozen=True)
class ProviderDefinition:
    id: str
    label: str
    default_api_base: str
    default_model: str
    requires_api_key: bool
    factory: str
    catalog_models: tuple[tuple[str, str], ...] = ()


PROVIDER_REGISTRY: tuple[ProviderDefinition, ...] = (
    ProviderDefinition(
        id="openai",
        label="OpenAI",
        default_api_base="https://api.openai.com/v1",
        default_model="gpt-4o",
        requires_api_key=True,
        factory="openai",
        catalog_models=(
            ("gpt-4o", "GPT-4o"),
            ("gpt-4o-mini", "GPT-4o Mini"),
            ("gpt-4-turbo", "GPT-4 Turbo"),
            ("gpt-4", "GPT-4"),
        ),
    ),
    ProviderDefinition(
        id="anthropic",
        label="Anthropic",
        default_api_base="https://api.anthropic.com/v1",
        default_model="claude-sonnet-4-20250514",
        requires_api_key=True,
        factory="openai_compatible",
        catalog_models=(
            ("claude-sonnet-4-20250514", "Claude Sonnet 4"),
            ("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet"),
            ("claude-3-5-haiku-20241022", "Claude 3.5 Haiku"),
        ),
    ),
    ProviderDefinition(
        id="google",
        label="Google Gemini",
        default_api_base="https://generativelanguage.googleapis.com/v1beta/openai/",
        default_model="gemini-2.0-flash",
        requires_api_key=True,
        factory="openai_compatible",
        catalog_models=(
            ("gemini-2.0-flash", "Gemini 2.0 Flash"),
            ("gemini-1.5-pro", "Gemini 1.5 Pro"),
            ("gemini-1.5-flash", "Gemini 1.5 Flash"),
        ),
    ),
    ProviderDefinition(
        id="deepseek",
        label="DeepSeek",
        default_api_base="https://api.deepseek.com",
        default_model="deepseek-chat",
        requires_api_key=True,
        factory="deepseek",
        catalog_models=(
            ("deepseek-chat", "DeepSeek Chat"),
            ("deepseek-reasoner", "DeepSeek Reasoner"),
        ),
    ),
    ProviderDefinition(
        id="qwen",
        label="Qwen (DashScope)",
        default_api_base="https://dashscope.aliyuncs.com/compatible-mode/v1",
        default_model="qwen-plus",
        requires_api_key=True,
        factory="openai_compatible",
        catalog_models=(
            ("qwen-plus", "Qwen Plus"),
            ("qwen-turbo", "Qwen Turbo"),
            ("qwen-max", "Qwen Max"),
        ),
    ),
    ProviderDefinition(
        id="kimi",
        label="Kimi (Moonshot)",
        default_api_base="https://api.moonshot.cn/v1",
        default_model="moonshot-v1-8k",
        requires_api_key=True,
        factory="openai_compatible",
        catalog_models=(
            ("moonshot-v1-8k", "Moonshot v1 8K"),
            ("moonshot-v1-32k", "Moonshot v1 32K"),
            ("moonshot-v1-128k", "Moonshot v1 128K"),
        ),
    ),
    ProviderDefinition(
        id="minimax",
        label="MiniMax",
        default_api_base="https://api.minimax.io/v1",
        default_model="MiniMax-M2.7",
        requires_api_key=True,
        factory="minimax",
        catalog_models=(
            ("MiniMax-M2.7", "MiniMax M2.7"),
            ("MiniMax-M2.7-highspeed", "MiniMax M2.7 Highspeed"),
        ),
    ),
    ProviderDefinition(
        id="mistral",
        label="Mistral AI",
        default_api_base="https://api.mistral.ai/v1",
        default_model="mistral-large-latest",
        requires_api_key=True,
        factory="openai_compatible",
        catalog_models=(
            ("mistral-large-latest", "Mistral Large"),
            ("mistral-small-latest", "Mistral Small"),
        ),
    ),
    ProviderDefinition(
        id="azure",
        label="Azure OpenAI",
        default_api_base="https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT",
        default_model="gpt-4o",
        requires_api_key=True,
        factory="openai_compatible",
        catalog_models=(("gpt-4o", "GPT-4o"), ("gpt-4o-mini", "GPT-4o Mini")),
    ),
    ProviderDefinition(
        id="zhipu",
        label="Zhipu AI",
        default_api_base="https://open.bigmodel.cn/api/paas/v4",
        default_model="glm-4-flash",
        requires_api_key=True,
        factory="openai_compatible",
        catalog_models=(
            ("glm-4-flash", "GLM-4 Flash"),
            ("glm-4-plus", "GLM-4 Plus"),
            ("glm-4-air", "GLM-4 Air"),
        ),
    ),
    ProviderDefinition(
        id="ollama",
        label="Ollama",
        default_api_base="http://localhost:11434",
        default_model="llama3.2",
        requires_api_key=False,
        factory="ollama",
        catalog_models=(),
    ),
)

SUPPORTED_LLM_PROVIDERS: tuple[str, ...] = tuple(p.id for p in PROVIDER_REGISTRY)

_PROVIDER_BY_ID: dict[str, ProviderDefinition] = {p.id: p for p in PROVIDER_REGISTRY}


def get_provider_definition(provider: str) -> ProviderDefinition | None:
    return _PROVIDER_BY_ID.get(provider.lower())


def list_provider_definitions() -> list[ProviderDefinition]:
    return list(PROVIDER_REGISTRY)
