"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  DEFAULT_KB_ICON_COLOR,
  getKbIconColorStyles,
  KB_ICON_COLOR_NAMES,
  type KbIconColor,
} from "@/lib/kb-icon-colors";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface KnowledgeBaseIconColorFieldProps {
  value: KbIconColor;
  onChange: (color: KbIconColor) => void;
}

export function KnowledgeBaseIconColorField({
  value,
  onChange,
}: KnowledgeBaseIconColorFieldProps) {
  const t = useTranslations("knowledgePage");

  return (
    <div className="space-y-2">
      <Label>{t("iconColorLabel")}</Label>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={4}
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as KbIconColor);
        }}
        aria-label={t("iconColorLabel")}
        className="flex flex-wrap"
      >
        {KB_ICON_COLOR_NAMES.map((name) => {
          const { swatch } = getKbIconColorStyles(name);
          const selected = value === name;
          return (
            <ToggleGroupItem
              key={name}
              value={name}
              aria-label={t(`iconColor.${name}`)}
              className={cn(
                "size-8 rounded-full border-transparent p-0 shadow-none",
                "data-[state=on]:border-transparent data-[state=on]:bg-transparent"
              )}
            >
              <span
                className={cn(
                  "size-5 rounded-full",
                  swatch,
                  selected &&
                    "ring-2 ring-ring ring-offset-2 ring-offset-background"
                )}
                aria-hidden
              />
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">{t("iconColorHint")}</p>
    </div>
  );
}

export { DEFAULT_KB_ICON_COLOR };
