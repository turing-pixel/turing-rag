"use client";

import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { DocumentFileIcon } from "@/components/knowledge-base/document-file-icon";
import {
  resolveTaskForFile,
  type ProcessingTaskStatusMap,
} from "@/lib/document-processing-poll";
import { formatProgressMessage } from "@/lib/progress-message-i18n";
import { formatPipelineFileSize } from "@/lib/processing-task-status-ui";
import type { PersistedProcessingTask } from "@/lib/document-upload-persistence";
import { cn } from "@/lib/utils";

export type PipelineFileItem = {
  file: File;
  status:
    | "pending"
    | "uploading"
    | "uploaded"
    | "processing"
    | "completed"
    | "error";
  uploadId?: number;
  taskId?: number;
  error?: string;
};

type DocumentProcessingPipelineListProps = {
  files: PipelineFileItem[];
  taskStatuses: ProcessingTaskStatusMap;
  resumeTasks?: PersistedProcessingTask[];
  formatStatus: (raw: string) => string;
  progressAriaLabel: string;
};

function PipelineItemStatus({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex max-w-44 items-center gap-2 text-xs text-muted-foreground sm:max-w-52",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DocumentProcessingPipelineList({
  files,
  taskStatuses,
  resumeTasks,
  formatStatus,
  progressAriaLabel,
}: DocumentProcessingPipelineListProps) {
  const tProgress = useTranslations("processingProgress");

  if (files.length === 0) {
    return null;
  }

  return (
    <ScrollArea>
      <ItemGroup className="gap-2">
        {files.map((file) => {
          const task = resolveTaskForFile(file, taskStatuses, resumeTasks);
          const taskStatus = task?.status;
          const isTaskActive =
            file.status === "processing" ||
            taskStatus === "pending" ||
            taskStatus === "processing";
          const rawProgressMessage = task?.progress_message?.trim();
          const statusLabel =
            rawProgressMessage != null && rawProgressMessage !== ""
              ? formatProgressMessage(rawProgressMessage, tProgress)
              : isTaskActive && taskStatus
                ? formatStatus(taskStatus)
                : "";
          const fileSize = formatPipelineFileSize(file.file.size);
          const hasError =
            task?.status === "failed" || file.status === "error";
          const isCompleted =
            taskStatus === "completed" || file.status === "completed";

          return (
            <Item
              key={file.uploadId ?? file.taskId ?? file.file.name}
              variant="outline"
              size="sm"
            >
              <ItemMedia>
                <DocumentFileIcon fileName={file.file.name} size="lg" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle>{file.file.name}</ItemTitle>
                {fileSize ? (
                  <ItemDescription>{fileSize}</ItemDescription>
                ) : null}
              </ItemContent>
              <ItemActions
                className="shrink-0 self-center"
                aria-label={isTaskActive ? progressAriaLabel : undefined}
                aria-live={isTaskActive ? "polite" : undefined}
              >
                {isTaskActive ? (
                  <PipelineItemStatus>
                    <Spinner className="size-3.5 shrink-0" aria-hidden />
                    {statusLabel ? (
                      <span className="min-w-0 truncate leading-snug">
                        {statusLabel}
                      </span>
                    ) : null}
                  </PipelineItemStatus>
                ) : null}
                {isCompleted ? (
                  <PipelineItemStatus>
                    <CheckCircle2
                      className="size-3.5 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span className="min-w-0 truncate leading-snug">
                      {formatStatus(taskStatus ?? "completed")}
                    </span>
                  </PipelineItemStatus>
                ) : null}
                {hasError ? (
                  <Badge
                    variant="destructive"
                    className="max-w-44 truncate font-normal sm:max-w-52"
                    title={task?.error_message || file.error}
                  >
                    {task?.error_message || file.error}
                  </Badge>
                ) : null}
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
    </ScrollArea>
  );
}
