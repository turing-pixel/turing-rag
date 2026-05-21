"use client";

import { useParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DocumentList } from "@/components/knowledge-base/document-list";
import { useDocumentUpload } from "@/components/knowledge-base/document-upload-provider";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { startChatWithKnowledgeBase } from "@/lib/start-chat";
import { Loader2, MessageSquare, PlusIcon } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

export default function KnowledgeBasePage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("knowledgePage");
  const tToasts = useTranslations("toasts");
  const knowledgeBaseId = parseInt(params.id as string);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const { openDocumentUpload, registerDocumentUploadComplete } =
    useDocumentUpload();

  useEffect(() => {
    return registerDocumentUploadComplete(knowledgeBaseId, () => {
      setRefreshKey((prev) => prev + 1);
    });
  }, [knowledgeBaseId, registerDocumentUploadComplete]);

  const handleUploadComplete = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleStartChat = useCallback(async () => {
    setIsStartingChat(true);
    try {
      const kb = await api.get(`/api/knowledge-base/${knowledgeBaseId}`);
      const data = await startChatWithKnowledgeBase(kb);
      router.push(`/dashboard/chat/${data.id}`);
    } catch (error) {
      console.error("Failed to start chat:", error);
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(tToasts("chatStartError"));
      }
    } finally {
      setIsStartingChat(false);
    }
  }, [knowledgeBaseId, router, tToasts]);

  return (
    <DashboardLayout>
      <DashboardPageContainer className="space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("detailHeading")}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={isStartingChat}
              onClick={() => void handleStartChat()}
            >
              {isStartingChat ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              {t("enterChat")}
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() =>
                openDocumentUpload(knowledgeBaseId, {
                  onComplete: handleUploadComplete,
                })
              }
            >
              <PlusIcon className="h-4 w-4" />
              {t("addDocument")}
            </Button>
          </div>
        </header>

        <DocumentList key={refreshKey} knowledgeBaseId={knowledgeBaseId} />
      </DashboardPageContainer>
    </DashboardLayout>
  );
}
