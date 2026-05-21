"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProviderIcon } from "@/components/llm/provider-icon";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProviderLabel } from "@/lib/llm-providers";
import {
  encodeModelValue,
  findModelLabel,
  selectionFromProviders,
  type LlmProviderOption,
  type LlmSelection,
} from "@/lib/llm-models";

interface ModelSelectorProps {
  providers: LlmProviderOption[];
  value: LlmSelection | null;
  onValueChange: (value: LlmSelection) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
  manageHref?: string;
}

export function ModelSelector({
  providers,
  value,
  onValueChange,
  disabled = false,
  className,
  size = "default",
  manageHref,
}: ModelSelectorProps) {
  const t = useTranslations("chatPage");

  if (!providers.length) {
    return (
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>{t("noModelsConfigured")}</p>
        {manageHref ? (
          <Link
            href={manageHref}
            className="text-primary underline-offset-4 hover:underline"
          >
            {t("goManageModels")}
          </Link>
        ) : null}
      </div>
    );
  }

  const normalizedValue = value
    ? selectionFromProviders(providers, value)
    : null;
  const selectedValue = normalizedValue
    ? encodeModelValue(normalizedValue)
    : undefined;
  const selectedLabel = normalizedValue
    ? findModelLabel(providers, normalizedValue)
    : t("modelPlaceholder");
  const selectedProvider = normalizedValue?.configId
    ? providers.find((p) =>
        p.models.some((m) => m.config_id === normalizedValue.configId)
      )?.provider
    : normalizedValue?.provider;

  return (
    <Select
      value={selectedValue}
      onValueChange={(nextValue) => {
        if (nextValue.startsWith("config:")) {
          const configId = Number(nextValue.slice("config:".length));
          if (!Number.isFinite(configId)) return;
          onValueChange(
            selectionFromProviders(providers, {
              configId,
              provider: "",
              model: "",
            })
          );
          return;
        }

        const separatorIndex = nextValue.indexOf("::");
        if (separatorIndex <= 0) return;
        onValueChange({
          provider: nextValue.slice(0, separatorIndex),
          model: nextValue.slice(separatorIndex + 2),
        });
      }}
      disabled={disabled}
    >
      <SelectTrigger className={className} size={size}>
        <SelectValue placeholder={t("modelPlaceholder")}>
          <span className="flex items-center gap-2">
            {selectedProvider ? (
              <ProviderIcon provider={selectedProvider} size={16} />
            ) : null}
            <span className="truncate">{selectedLabel}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {providers.map((provider) => (
          <SelectGroup key={provider.provider}>
            <SelectLabel className="flex items-center gap-2">
              <ProviderIcon provider={provider.provider} size={16} />
              {getProviderLabel(provider.provider, provider.label)}
            </SelectLabel>
            {provider.models.map((model) => (
              <SelectItem
                key={
                  model.config_id != null
                    ? `config-${model.config_id}`
                    : `${provider.provider}-${model.model}`
                }
                value={
                  model.config_id != null
                    ? `config:${model.config_id}`
                    : encodeModelValue({
                        provider: provider.provider,
                        model: model.model,
                      })
                }
              >
                <span className="flex items-center gap-2 pl-6">
                  <ProviderIcon provider={provider.provider} size={14} />
                  <span>{model.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
