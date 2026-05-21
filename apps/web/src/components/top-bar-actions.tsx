"use client";

import { DocumentUploadActivityButton } from "@/components/knowledge-base/document-upload-activity-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

export function TopBarActions({
  className,
  actionClassName,
}: {
  className?: string;
  actionClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DocumentUploadActivityButton className={actionClassName} />
      <ThemeToggle className={actionClassName} />
      <LocaleSwitcher className={actionClassName} />
    </div>
  );
}
