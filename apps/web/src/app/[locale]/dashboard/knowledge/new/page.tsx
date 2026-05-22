"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import {
  KnowledgeBaseIconField,
  DEFAULT_KB_ICON,
} from "@/components/knowledge-base/knowledge-base-icon-field";
import { DEFAULT_KB_ICON_COLOR } from "@/components/knowledge-base/knowledge-base-icon-color-field";
import type { KbIconName } from "@/lib/kb-icons";
import type { KbIconColor } from "@/lib/kb-icon-colors";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewKnowledgeBasePage() {
  const router = useRouter();
  const t = useTranslations("toasts");
  const tKb = useTranslations("knowledgePage");
  const [error, setError] = useState("");
  const [icon, setIcon] = useState<KbIconName>(DEFAULT_KB_ICON);
  const [iconColor, setIconColor] = useState<KbIconColor>(DEFAULT_KB_ICON_COLOR);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;

      const data = await api.post("/api/knowledge-base", {
        name,
        description,
        icon,
        icon_color: iconColor,
      });

      router.push(`/dashboard/knowledge/${data.id}`);
    } catch (error) {
      console.error("Failed to create knowledge base:", error);
      if (error instanceof ApiError) {
        setError(error.message);
        toast.error(error.message);
      } else {
        setError(t("kbCreateError"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardPageContainer className="space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tKb("createPageTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tKb("createPageSubtitle")}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <KnowledgeBaseIconField
            value={icon}
            onChange={setIcon}
            colorValue={iconColor}
            onColorChange={setIconColor}
          />

          <div className="space-y-2">
            <Label htmlFor="name">{tKb("name")}</Label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              placeholder={tKb("namePlaceholderCreate")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{tKb("description")}</Label>
            <Textarea
              id="description"
              name="description"
              placeholder={tKb("descPlaceholderCreate")}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {tKb("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? tKb("creatingKb") : tKb("createSubmit")}
            </Button>
          </div>
        </form>
    </DashboardPageContainer>
  );
}
