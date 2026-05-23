"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Library } from "lucide-react";

import { KnowledgeBaseIcon } from "@/components/knowledge-base/knowledge-base-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export interface KnowledgeBaseOption {
  uuid: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  icon_color?: string | null;
}

interface KnowledgeBasePickerProps {
  knowledgeBases: KnowledgeBaseOption[];
  selectedUuids: string[];
  onSelectedUuidsChange: (uuids: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function KnowledgeBasePicker({
  knowledgeBases,
  selectedUuids,
  onSelectedUuidsChange,
  disabled = false,
  className,
}: KnowledgeBasePickerProps) {
  const t = useTranslations("chatPage");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selectedUuids), [selectedUuids]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return knowledgeBases;
    return knowledgeBases.filter(
      (kb) =>
        kb.name.toLowerCase().includes(q) ||
        (kb.description ?? "").toLowerCase().includes(q)
    );
  }, [knowledgeBases, search]);

  const selectedNames = useMemo(
    () =>
      knowledgeBases
        .filter((kb) => selectedSet.has(kb.uuid))
        .map((kb) => kb.name),
    [knowledgeBases, selectedSet]
  );

  const triggerLabel =
    selectedNames.length === 0
      ? t("kbPickerNone")
      : selectedNames.length === 1
        ? selectedNames[0]
        : t("kbPickerCount", { count: selectedNames.length });

  const toggleUuid = (uuid: string) => {
    if (selectedSet.has(uuid)) {
      onSelectedUuidsChange(selectedUuids.filter((x) => x !== uuid));
    } else {
      onSelectedUuidsChange([...selectedUuids, uuid]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || knowledgeBases.length === 0}
          className={cn("max-w-[14rem] justify-between gap-1", className)}
          aria-label={t("knowledgeBaseLabel")}
        >
          <Library className="size-4 shrink-0 opacity-70" />
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(20rem,calc(100vw-2rem))] p-0"
      >
        <PopoverHeader className="gap-0.5 border-b border-border px-3 py-2">
          <PopoverTitle className="text-sm leading-snug">
            {t("knowledgeBaseLabel")}
          </PopoverTitle>
          <PopoverDescription className="text-xs leading-snug">
            {t("multiSelectHint")}
          </PopoverDescription>
        </PopoverHeader>
        {knowledgeBases.length > 4 ? (
          <div className="border-b border-border px-2 py-1.5">
            <InputGroup className="h-8">
              <InputGroupInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("kbSearchPlaceholder")}
                aria-label={t("kbSearchPlaceholder")}
                className="text-sm"
              />
              <InputGroupAddon align="inline-end">
                <Check className="size-3.5 opacity-0" aria-hidden />
              </InputGroupAddon>
            </InputGroup>
          </div>
        ) : null}
        <div className="max-h-56 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {t("kbSearchNoResults")}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((kb) => {
                const checked = selectedSet.has(kb.uuid);
                return (
                  <li key={kb.uuid}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1",
                        "hover:bg-muted/80",
                        checked && "bg-muted/60"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleUuid(kb.uuid)}
                        className="size-3.5 shrink-0"
                        aria-label={kb.name}
                      />
                      <KnowledgeBaseIcon
                        icon={kb.icon}
                        iconColor={kb.icon_color}
                        className="size-7 shrink-0 rounded-md"
                        iconClassName="size-3.5"
                      />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-sm font-medium">
                          {kb.name}
                        </span>
                        {kb.description ? (
                          <span className="line-clamp-1 text-xs text-muted-foreground">
                            {kb.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
