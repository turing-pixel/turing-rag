const STORAGE_KEY = "rag-document-processing-job";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PersistedProcessingTask = {
  taskId: number;
  uploadId: number;
  fileName?: string;
};

export type PersistedProcessingJob = {
  knowledgeBaseUuid: string;
  tasks: PersistedProcessingTask[];
  startedAt: number;
};

export function saveProcessingJob(job: PersistedProcessingJob): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(job));
  } catch {
    // Ignore quota / private mode errors
  }
}

export function loadProcessingJob(): PersistedProcessingJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const job = JSON.parse(raw) as PersistedProcessingJob;
    if (
      !job?.knowledgeBaseUuid ||
      !Array.isArray(job.tasks) ||
      job.tasks.length === 0
    ) {
      clearProcessingJob();
      return null;
    }
    if (Date.now() - job.startedAt > MAX_AGE_MS) {
      clearProcessingJob();
      return null;
    }
    return job;
  } catch {
    clearProcessingJob();
    return null;
  }
}

export function clearProcessingJob(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
