export type DocumentProcessingTask = {
  id: number;
  status: string;
  progress?: number;
  progress_message?: string | null;
  error_message: string | null;
};

export type DocumentWithTasks = {
  id: number;
  processing_tasks: DocumentProcessingTask[];
};

export function getLatestProcessingTask(
  tasks: DocumentProcessingTask[] | undefined
): DocumentProcessingTask | null {
  if (!tasks?.length) return null;
  return tasks.reduce((latest, task) =>
    task.id > latest.id ? task : latest
  );
}

export function isDocumentProcessingFromTask(
  task: DocumentProcessingTask | null
): boolean {
  return task?.status === "pending" || task?.status === "processing";
}
