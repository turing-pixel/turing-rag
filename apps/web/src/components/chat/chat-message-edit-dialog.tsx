"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ChatMessageEditDialogProps {
  open: boolean;
  initialContent: string;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (content: string) => void | Promise<void>;
}

export function ChatMessageEditDialog({
  open,
  initialContent,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: ChatMessageEditDialogProps) {
  const t = useTranslations("chatPage");
  const [draft, setDraft] = useState(initialContent);

  useEffect(() => {
    if (open) {
      setDraft(initialContent);
    }
  }, [open, initialContent]);

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed || isSubmitting) return;
    void onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editMessageTitle")}</DialogTitle>
          <DialogDescription>{t("editMessageDescription")}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          disabled={isSubmitting}
          placeholder={t("messagePlaceholder")}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !draft.trim()}
          >
            {isSubmitting ? t("savingEdit") : t("saveAndRegenerate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
