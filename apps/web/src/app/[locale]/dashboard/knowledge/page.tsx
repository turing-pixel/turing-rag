"use client";

import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Library } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import {
  KnowledgeBaseCard,
  type KnowledgeBaseCardItem,
} from "@/components/knowledge-base/knowledge-base-card";
import { KnowledgeBaseIconField } from "@/components/knowledge-base/knowledge-base-icon-field";
import { resolveKbIconName, type KbIconName } from "@/lib/kb-icons";
import {
  DEFAULT_KB_ICON_COLOR,
  resolveKbIconColor,
  type KbIconColor,
} from "@/lib/kb-icon-colors";
import { useDocumentUpload } from "@/components/knowledge-base/document-upload-provider";
import { api, ApiError } from "@/lib/api";
import { startChatWithKnowledgeBase } from "@/lib/start-chat";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KnowledgeBaseGridSkeleton } from "@/components/skeletons/knowledge-base-grid-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type KnowledgeBase = KnowledgeBaseCardItem;

export default function KnowledgeBasePage() {
  const router = useRouter();
  const locale = useLocale();
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";
  const t = useTranslations("toasts");
  const tPage = useTranslations("knowledgePage");
  const tBreadcrumbSeg = useTranslations("dashboard.breadcrumb.segments");
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState<KbIconName>("library");
  const [editIconColor, setEditIconColor] =
    useState<KbIconColor>(DEFAULT_KB_ICON_COLOR);
  const [isSaving, setIsSaving] = useState(false);
  const [startingChatKbId, setStartingChatKbId] = useState<number | null>(null);
  const { openDocumentUpload } = useDocumentUpload();

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const fetchKnowledgeBases = async () => {
    try {
      const data = await api.get("/api/knowledge-base");
      setKnowledgeBases(data);
    } catch (error) {
      console.error("Failed to fetch knowledge bases:", error);
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (kb: KnowledgeBase) => {
    setEditingKb(kb);
    setEditName(kb.name);
    setEditDescription(kb.description || "");
    setEditIcon(resolveKbIconName(kb.icon));
    setEditIconColor(resolveKbIconColor(kb.icon_color));
  };

  const closeEditDialog = (force = false) => {
    if (isSaving && !force) return;
    setEditingKb(null);
    setEditName("");
    setEditDescription("");
    setEditIcon("library");
    setEditIconColor(DEFAULT_KB_ICON_COLOR);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKb) return;

    const name = editName.trim();
    if (!name) {
      toast.error(t("kbNameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const updated = await api.put(`/api/knowledge-base/${editingKb.id}`, {
        name,
        description: editDescription.trim() || null,
        icon: editIcon,
        icon_color: editIconColor,
      });
      setKnowledgeBases((prev) =>
        prev.map((kb) =>
          kb.id === editingKb.id
            ? {
                ...kb,
                name: updated.name,
                description: updated.description,
                icon: updated.icon,
                icon_color: updated.icon_color,
              }
            : kb
        )
      );
      toast.success(t("kbUpdated"));
      closeEditDialog(true);
    } catch (error) {
      console.error("Failed to update knowledge base:", error);
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickChat = async (kb: KnowledgeBase) => {
    setStartingChatKbId(kb.id);
    try {
      const data = await startChatWithKnowledgeBase(kb);
      router.push(`/dashboard/chat/${data.id}`);
    } catch (error) {
      console.error("Failed to start chat:", error);
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("chatStartError"));
      }
    } finally {
      setStartingChatKbId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(tPage("confirmDelete"))) return;
    try {
      await api.delete(`/api/knowledge-base/${id}`);
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
      toast.success(t("kbDeleted"));
    } catch (error) {
      console.error("Failed to delete knowledge base:", error);
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  return (
    <DashboardLayout>
      <DashboardPageContainer className="space-y-6" aria-busy={loading}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {tPage("title")}
            </h1>
            <p className="text-sm text-muted-foreground">{tPage("subtitle")}</p>
          </div>
          <Button asChild className="w-full shrink-0 gap-2 sm:w-auto">
            <Link href="/dashboard/knowledge/new">
              <Plus className="size-4" />
              {tPage("newButton")}
            </Link>
          </Button>
        </header>

        {loading ? (
          <KnowledgeBaseGridSkeleton />
        ) : knowledgeBases.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Library className="size-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                {tPage("empty")}
              </p>
              <Button asChild className="mt-6 gap-2">
                <Link href="/dashboard/knowledge/new">
                  <Plus className="size-4" />
                  {tPage("newButton")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {knowledgeBases.map((kb) => (
              <KnowledgeBaseCard
                key={kb.id}
                kb={kb}
                dateLocale={dateLocale}
                testRetrievalLabel={tBreadcrumbSeg("test-retrieval")}
                isStartingChat={startingChatKbId === kb.id}
                onEdit={() => openEditDialog(kb)}
                onDelete={() => handleDelete(kb.id)}
                onQuickChat={() => handleQuickChat(kb)}
                onUploadDocument={() =>
                  openDocumentUpload(kb.id, {
                    onComplete: () => void fetchKnowledgeBases(),
                  })
                }
              />
            ))}
          </div>
        )}

        <Dialog
          open={editingKb !== null}
          onOpenChange={(open) => !open && closeEditDialog()}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-0">
              <DialogHeader>
                <DialogTitle>{tPage("editTitle")}</DialogTitle>
                <DialogDescription>{tPage("editSubtitle")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <KnowledgeBaseIconField
                  value={editIcon}
                  onChange={setEditIcon}
                  colorValue={editIconColor}
                  onColorChange={setEditIconColor}
                />
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-name">{tPage("name")}</Label>
                  <Input
                    id="edit-name"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={tPage("namePlaceholder")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-description">
                    {tPage("description")}
                  </Label>
                  <Textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder={tPage("descPlaceholder")}
                    className="min-h-20"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closeEditDialog()}
                  disabled={isSaving}
                >
                  {tPage("cancel")}
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? tPage("saving") : tPage("save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DashboardPageContainer>
    </DashboardLayout>
  );
}
