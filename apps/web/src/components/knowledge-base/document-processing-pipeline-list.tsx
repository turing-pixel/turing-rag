"use client";

import { CheckCircle2 } from "lucide-react";
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
import { formatPipelineFileSize } from "@/lib/processing-task-status-ui";
import type { PersistedProcessingTask } from "@/lib/document-upload-persistence";

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

export function DocumentProcessingPipelineList({
  files,
  taskStatuses,
  resumeTasks,
  formatStatus,
  progressAriaLabel,
}: DocumentProcessingPipelineListProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <ScrollArea>
      <ItemGroup>
        {files.map((file) => {
          const task = resolveTaskForFile(file, taskStatuses, resumeTasks);
          const taskStatus = task?.status ?? "processing";
          const taskProgress =
            taskStatus === "completed" ? 100 : (task?.progress ?? 0);
          const isTaskActive =
            taskStatus === "pending" || taskStatus === "processing";
          const fileSize = formatPipelineFileSize(file.file.size);
          const hasError =
            task?.status === "failed" || file.status === "error";

          return (
            <Item
              key={file.uploadId ?? file.taskId ?? file.file.name}
              variant="outline"
            >
              <ItemMedia>
                <DocumentFileIcon fileName={file.file.name} size="lg" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{file.file.name}</ItemTitle>
                {fileSize ? (
                  <ItemDescription>{fileSize}</ItemDescription>
                ) : null}
              </ItemContent>
              <ItemActions
                aria-label={isTaskActive ? progressAriaLabel : undefined}
                aria-live={isTaskActive ? "polite" : undefined}
              >
                {isTaskActive ? (
                  <>
                    <Spinner />
                    <ItemDescription>{taskProgress}%</ItemDescription>
                  </>
                ) : null}
                {taskStatus === "completed" ? (
                  <>
                    <CheckCircle2 aria-hidden />
                    <ItemDescription>{formatStatus(taskStatus)}</ItemDescription>
                  </>
                ) : null}
                {hasError ? (
                  <Badge
                    variant="destructive"
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
