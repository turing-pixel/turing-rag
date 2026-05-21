"use client";

import { useTranslations } from "next-intl";
import { useDocumentUpload } from "@/components/knowledge-base/document-upload-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function DocumentUploadActivityButton({
  className,
}: {
  className?: string;
}) {
  const t = useTranslations("knowledgePage");
  const { isUploadProcessing, openProcessingDialog, isUploadDialogOpen } =
    useDocumentUpload();

  if (!isUploadProcessing) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={cn(
        "size-8 shrink-0",
        isUploadDialogOpen && "border-primary/50 bg-primary/5",
        className
      )}
      title={t("viewProcessingUpload")}
      aria-label={t("viewProcessingUpload")}
      onClick={openProcessingDialog}
    >
      <Spinner className="text-primary" aria-hidden />
    </Button>
  );
}
