"use client";

import { Binary, Bot, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { ProviderIcon } from "@/components/llm/provider-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Link } from "@/i18n/navigation";
import { getProviderLabel } from "@/lib/llm-providers";

export interface ModelDefaultPreference {
  source: string;
  config_id?: number | null;
  config_name?: string | null;
  provider?: string | null;
  model?: string | null;
  configured: boolean;
}

type PreferenceModelItemProps = {
  pref: ModelDefaultPreference;
  manageHref: string;
  manageLabel: string;
  kind: "llm" | "embedding";
};

function preferenceTitle(
  pref: ModelDefaultPreference,
  envDefaultName: string,
  notConfigured: string
): string {
  if (!pref.configured) {
    return notConfigured;
  }
  if (pref.source === "config" && pref.config_name) {
    return pref.config_name;
  }
  return envDefaultName;
}

function preferenceDescription(pref: ModelDefaultPreference): string | null {
  if (!pref.configured || !pref.provider || !pref.model) {
    return null;
  }
  return `${getProviderLabel(pref.provider)} / ${pref.model}`;
}

export function PreferenceModelItem({
  pref,
  manageHref,
  manageLabel,
  kind,
}: PreferenceModelItemProps) {
  const t = useTranslations("accountPage");
  const tLlm = useTranslations("llmConfigsPage");
  const title = preferenceTitle(
    pref,
    tLlm("envDefaultDisplayName"),
    t("notConfigured")
  );
  const description = preferenceDescription(pref);
  const FallbackIcon = kind === "llm" ? Bot : Binary;

  return (
    <Item variant="outline">
      <ItemMedia>
        {pref.configured && pref.provider ? (
          <ProviderIcon provider={pref.provider} size={20} />
        ) : (
          <FallbackIcon />
        )}
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        {description ? <ItemDescription>{description}</ItemDescription> : null}
      </ItemContent>
      <ItemActions>
        {pref.configured ? (
          <Badge variant="secondary">
            {pref.source === "config" ? t("sourceConfig") : t("sourceEnv")}
          </Badge>
        ) : null}
        <Button variant="outline" size="sm" asChild>
          <Link href={manageHref}>
            {manageLabel}
            <ChevronRight />
          </Link>
        </Button>
      </ItemActions>
    </Item>
  );
}
