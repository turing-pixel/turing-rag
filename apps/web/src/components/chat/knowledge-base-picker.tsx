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
  id: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  icon_color?: string | null;
}

interface KnowledgeBasePickerProps {
  knowledgeBases: KnowledgeBaseOption[];
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  disabled?: boolean;
  className?: string;
}

export function KnowledgeBasePicker({
  knowledgeBases,
  selectedIds,
  onSelectedIdsChange,
  disabled = false,
  className,
}: KnowledgeBasePickerProps) {
  const t = useTranslations("chatPage");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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
        .filter((kb) => selectedSet.has(kb.id))
        .map((kb) => kb.name),
    [knowledgeBases, selectedSet]
  );

  const triggerLabel =
    selectedNames.length === 0
      ? t("kbPickerNone")
      : selectedNames.length === 1
        ? selectedNames[0]
        : t("kbPickerCount", { count: selectedNames.length });

  const toggleId = (id: number) => {
    if (selectedSet.has(id)) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectedIdsChange([...selectedIds, id]);
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
      <PopoverContent align="start" className="w-80 p-0">
        <PopoverHeader className="border-b border-border px-4 py-3">
          <PopoverTitle>{t("knowledgeBaseLabel")}</PopoverTitle>
          <PopoverDescription>{t("multiSelectHint")}</PopoverDescription>
        </PopoverHeader>
        {knowledgeBases.length > 4 ? (
          <div className="border-b border-border px-3 py-2">
            <InputGroup>
              <InputGroupInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("kbSearchPlaceholder")}
                aria-label={t("kbSearchPlaceholder")}
              />
              <InputGroupAddon align="inline-end">
                <Check className="size-4 opacity-0" aria-hidden />
              </InputGroupAddon>
            </InputGroup>
          </div>
        ) : null}
        <div className="max-h-64 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              {t("kbSearchNoResults")}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((kb) => {
                const checked = selectedSet.has(kb.id);
                return (
                  <li key={kb.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md px-2 py-2",
                        "hover:bg-muted/80",
                        checked && "bg-muted/60"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleId(kb.id)}
                        className="mt-0.5"
                        aria-label={kb.name}
                      />
                      <KnowledgeBaseIcon
                        icon={kb.icon}
                        iconColor={kb.icon_color}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {kb.name}
                        </span>
                        {kb.description ? (
                          <span className="line-clamp-2 text-xs text-muted-foreground">
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
