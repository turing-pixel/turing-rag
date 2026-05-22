"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useDocumentUpload } from "@/components/knowledge-base/document-upload-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function averageProgress(
  statuses: Record<number, { progress?: number; status: string }>
): number | null {
  const tasks = Object.values(statuses);
  if (tasks.length === 0) return null;
  const sum = tasks.reduce(
    (acc, task) =>
      acc +
      (task.status === "completed"
        ? 100
        : Math.max(0, Math.min(100, task.progress ?? 0))),
    0
  );
  return Math.round(sum / tasks.length);
}

export function DocumentUploadActivityButton({
  className,
}: {
  className?: string;
}) {
  const t = useTranslations("knowledgePage");
  const {
    isUploadProcessing,
    openProcessingDialog,
    isUploadDialogOpen,
    processingTaskStatuses,
  } = useDocumentUpload();

  const progress = useMemo(
    () => averageProgress(processingTaskStatuses),
    [processingTaskStatuses]
  );

  if (!isUploadProcessing) {
    return null;
  }

  const showPercent = progress != null && progress > 0;
  const label = showPercent
    ? t("viewProcessingUploadWithProgress", { percent: progress })
    : t("viewProcessingUpload");

  return (
    <Button
      type="button"
      variant={isUploadDialogOpen ? "default" : "outline"}
      size={showPercent ? "default" : "icon"}
      className={className}
      title={label}
      aria-label={label}
      onClick={openProcessingDialog}
    >
      <Spinner aria-hidden />
      {showPercent ? (
        <span className="tabular-nums">{progress}%</span>
      ) : null}
    </Button>
  );
}
