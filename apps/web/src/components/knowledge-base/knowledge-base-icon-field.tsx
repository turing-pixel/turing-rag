"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_KB_ICON,
  KB_ICON_NAMES,
  KB_ICONS,
  type KbIconName,
} from "@/lib/kb-icons";
import {
  getKbIconColorStyles,
  type KbIconColor,
} from "@/lib/kb-icon-colors";
import { getKbIconLabel } from "@/lib/kb-icon-labels";
import { KnowledgeBaseIconColorField } from "@/components/knowledge-base/knowledge-base-icon-color-field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface KnowledgeBaseIconFieldProps {
  value: KbIconName;
  onChange: (icon: KbIconName) => void;
  colorValue: KbIconColor;
  onColorChange: (color: KbIconColor) => void;
}

export function KnowledgeBaseIconField({
  value,
  onChange,
  colorValue,
  onColorChange,
}: KnowledgeBaseIconFieldProps) {
  const locale = useLocale();
  const t = useTranslations("knowledgePage");
  const [open, setOpen] = useState(false);
  const SelectedIcon = KB_ICONS[value];
  const { pedestal, icon: iconTone } = getKbIconColorStyles(colorValue);

  const handleSelect = (name: KbIconName) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="kb-icon-picker">{t("iconLabel")}</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <InputGroup
              id="kb-icon-picker"
              className="h-10 cursor-pointer"
              aria-label={t("iconChoose")}
            >
              <InputGroupAddon align="inline-start" className="pl-2.5">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                    pedestal
                  )}
                >
                  <SelectedIcon className={cn("size-4", iconTone)} aria-hidden />
                </span>
              </InputGroupAddon>
              <InputGroupInput
                readOnly
                tabIndex={-1}
                value={getKbIconLabel(value, locale)}
                className="cursor-pointer"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  tabIndex={-1}
                  aria-hidden
                >
                  <ChevronDown
                    className={cn(
                      "text-muted-foreground transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-2.5">
            <div
              className="grid max-h-64 grid-cols-8 gap-1.5 overflow-y-auto"
              role="radiogroup"
              aria-label={t("iconLabel")}
            >
              {KB_ICON_NAMES.map((name) => {
                const Icon = KB_ICONS[name];
                const selected = value === name;
                return (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={getKbIconLabel(name, locale)}
                    onClick={() => handleSelect(name)}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md border transition-colors",
                      selected
                        ? cn("border-primary", pedestal, iconTone)
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">{t("iconHint")}</p>
      </div>
      <KnowledgeBaseIconColorField
        value={colorValue}
        onChange={onColorChange}
      />
    </div>
  );
}

export { DEFAULT_KB_ICON };
