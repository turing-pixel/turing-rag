"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { DocumentProcessingTask } from "@/lib/document-list-processing";
import { formatProgressMessage } from "@/lib/progress-message-i18n";
import { processingStatusBadgeVariant } from "@/lib/processing-task-status-ui";

type ProcessingTaskHistoryListProps = {
  tasks: DocumentProcessingTask[];
  formatStatus: (raw: string) => string;
  taskLabel: (id: number) => string;
  emptyLabel: string;
};

export function ProcessingTaskHistoryList({
  tasks,
  formatStatus,
  taskLabel,
  emptyLabel,
}: ProcessingTaskHistoryListProps) {
  const tProgress = useTranslations("processingProgress");

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y text-sm">
      {tasks.map((task) => {
        const isActive =
          task.status === "pending" || task.status === "processing";
        const rawProgressMessage = task.progress_message?.trim();
        const progressHint =
          rawProgressMessage != null && rawProgressMessage !== ""
            ? formatProgressMessage(rawProgressMessage, tProgress)
            : isActive
              ? formatStatus(task.status)
              : null;

        return (
          <li
            key={task.id}
            className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{taskLabel(task.id)}</p>
              {task.error_message ? (
                <p className="text-xs text-destructive">{task.error_message}</p>
              ) : null}
              {isActive && progressHint ? (
                <p className="text-xs text-muted-foreground">{progressHint}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isActive ? <Spinner aria-hidden /> : null}
              <Badge variant={processingStatusBadgeVariant(task.status)}>
                {formatStatus(task.status)}
              </Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
