"use client";

import { DocumentUploadActivityButton } from "@/components/knowledge-base/document-upload-activity-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

export function TopBarActions({
  className,
  actionClassName,
  showDocumentUpload = false,
}: {
  className?: string;
  actionClassName?: string;
  /** Show background document processing progress (dashboard shell only). */
  showDocumentUpload?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showDocumentUpload ? (
        <DocumentUploadActivityButton className={actionClassName} />
      ) : null}
      <ThemeToggle className={actionClassName} />
      <LocaleSwitcher className={actionClassName} />
    </div>
  );
}
