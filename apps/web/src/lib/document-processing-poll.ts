import { api } from "@/lib/api";

/** Poll interval; keep short so UI tracks backend progress commits. */
export const PROCESSING_POLL_INTERVAL_MS = 1000;

export type ProcessingTaskStatus = {
  document_id: number | null;
  upload_id: number;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  progress_message?: string | null;
  error_message?: string;
  file_name?: string;
};

export type ProcessingTaskStatusMap = Record<number, ProcessingTaskStatus>;

export type TaskLookupFile = {
  uploadId?: number;
  taskId?: number;
};

/** Resolve polled task status for a pipeline file (by taskId, then uploadId). */
export function resolveTaskForFile(
  file: TaskLookupFile,
  statuses: ProcessingTaskStatusMap,
  resumeTasks?: { taskId: number; uploadId: number }[]
): ProcessingTaskStatus | undefined {
  if (file.taskId != null && statuses[file.taskId]) {
    return statuses[file.taskId];
  }
  if (file.uploadId != null) {
    const byUpload = Object.values(statuses).find(
      (t) => t.upload_id === file.uploadId
    );
    if (byUpload) return byUpload;
  }
  if (file.uploadId != null && resumeTasks?.length) {
    const persisted = resumeTasks.find((t) => t.uploadId === file.uploadId);
    if (persisted && statuses[persisted.taskId]) {
      return statuses[persisted.taskId];
    }
  }
  return undefined;
}

export function mergeTaskStatusMaps(
  ...maps: (ProcessingTaskStatusMap | undefined)[]
): ProcessingTaskStatusMap {
  return maps.reduce<ProcessingTaskStatusMap>(
    (acc, map) => (map ? { ...acc, ...map } : acc),
    {}
  );
}

type TaskStatusResponse = Record<string, ProcessingTaskStatus>;

export type RunProcessingPollOptions = {
  knowledgeBaseUuid: string;
  taskIds: number[];
  uploadIdByTaskId: Map<number, number>;
  shouldAbort: () => boolean;
  onUpdate?: (statuses: ProcessingTaskStatusMap) => void;
  onDone: (result: {
    allSucceeded: boolean;
    failedTasks: ProcessingTaskStatus[];
  }) => void;
  onError: () => void;
  pollIntervalMs?: number;
  maxRetries?: number;
};

function parseTaskStatuses(
  response: TaskStatusResponse,
  uploadIdByTaskId: Map<number, number>
): ProcessingTaskStatusMap {
  return Object.entries(response).reduce<ProcessingTaskStatusMap>(
    (acc, [key, value]) => {
      const taskId = parseInt(key, 10);
      const raw = value as ProcessingTaskStatus & { upload_id?: number };
      acc[taskId] = {
        document_id: raw.document_id ?? null,
        upload_id: raw.upload_id ?? uploadIdByTaskId.get(taskId) ?? 0,
        status: raw.status,
        progress:
          typeof raw.progress === "number"
            ? Math.max(0, Math.min(100, raw.progress))
            : raw.status === "completed"
              ? 100
              : 0,
        progress_message: raw.progress_message ?? null,
        error_message: raw.error_message,
        file_name: raw.file_name,
      };
      return acc;
    },
    {}
  );
}

export function runProcessingPoll({
  knowledgeBaseUuid,
  taskIds,
  uploadIdByTaskId,
  shouldAbort,
  onUpdate,
  onDone,
  onError,
  pollIntervalMs = PROCESSING_POLL_INTERVAL_MS,
  maxRetries = 3,
}: RunProcessingPollOptions): void {
  let statusPollRetries = 0;

  const poll = async () => {
    if (shouldAbort()) return;

    try {
      const response = (await api.get(
        `/api/knowledge-base/${knowledgeBaseUuid}/documents/tasks?task_ids=${taskIds.join(
          ","
        )}`
      )) as TaskStatusResponse;

      const data = parseTaskStatuses(response, uploadIdByTaskId);
      statusPollRetries = 0;
      onUpdate?.(data);

      const allDone =
        taskIds.length > 0 &&
        taskIds.every((id) => {
          const task = data[id];
          return (
            task != null &&
            (task.status === "completed" || task.status === "failed")
          );
        });

      if (allDone) {
        const failedTasks = Object.values(data).filter(
          (task) => task.status === "failed"
        );
        onDone({
          allSucceeded: failedTasks.length === 0,
          failedTasks,
        });
      } else if (!shouldAbort()) {
        setTimeout(poll, pollIntervalMs);
      }
    } catch {
      statusPollRetries += 1;
      if (statusPollRetries < maxRetries && !shouldAbort()) {
        setTimeout(poll, pollIntervalMs);
        return;
      }
      onError();
    }
  };

  void poll();
}
