"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  DocumentProcessingCompleteAlert,
  type ProcessingCompleteAlertState,
} from "@/components/knowledge-base/document-processing-complete-alert";
import { DocumentUploadSteps } from "@/components/knowledge-base/document-upload-steps";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  runProcessingPoll,
  type ProcessingTaskStatusMap,
} from "@/lib/document-processing-poll";
import {
  clearProcessingJob,
  loadProcessingJob,
  saveProcessingJob,
  type PersistedProcessingJob,
} from "@/lib/document-upload-persistence";

type OpenDocumentUploadOptions = {
  onComplete?: () => void;
};

export type ProcessingPollCallbacks = {
  onUpdate: (statuses: ProcessingTaskStatusMap) => void;
  onDone: (result: {
    allSucceeded: boolean;
    failedTasks: { file_name?: string; upload_id: number }[];
  }) => void;
  onError: () => void;
};

type DocumentUploadContextValue = {
  openDocumentUpload: (
    knowledgeBaseUuid: string,
    options?: OpenDocumentUploadOptions
  ) => void;
  openProcessingDialog: () => void;
  registerDocumentUploadComplete: (
    knowledgeBaseUuid: string,
    listener: () => void
  ) => () => void;
  startProcessingJob: (
    job: PersistedProcessingJob,
    callbacks: ProcessingPollCallbacks
  ) => void;
  isUploadDialogOpen: boolean;
  isUploadProcessing: boolean;
  activeProcessingJob: PersistedProcessingJob | null;
  processingTaskStatuses: ProcessingTaskStatusMap;
};

const DocumentUploadContext = createContext<DocumentUploadContextValue | null>(
  null
);

export function useDocumentUpload() {
  const ctx = useContext(DocumentUploadContext);
  if (!ctx) {
    throw new Error(
      "useDocumentUpload must be used within DocumentUploadProvider"
    );
  }
  return ctx;
}

type UploadSession = {
  knowledgeBaseUuid: string;
  sessionKey: number;
  resumeMode: boolean;
};

export function DocumentUploadProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("knowledgePage");
  const tToast = useTranslations("toasts");
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<UploadSession | null>(null);
  const [activeJob, setActiveJob] = useState<PersistedProcessingJob | null>(
    null
  );
  const [processingTaskStatuses, setProcessingTaskStatuses] =
    useState<ProcessingTaskStatusMap>({});
  const [isUploadProcessing, setIsUploadProcessing] = useState(false);
  const [completeAlert, setCompleteAlert] =
    useState<ProcessingCompleteAlertState>({
      open: false,
      variant: "success",
      failedFileNames: [],
    });
  const isProcessingRef = useRef(false);
  const pollAbortRef = useRef(false);
  const resumeStartedRef = useRef(false);
  const pollCallbacksRef = useRef<ProcessingPollCallbacks | null>(null);
  const listenersRef = useRef<Map<string, Set<() => void>>>(new Map());
  const pendingOnCompleteRef = useRef<(() => void) | undefined>(undefined);

  const registerDocumentUploadComplete = useCallback(
    (knowledgeBaseUuid: string, listener: () => void) => {
      const map = listenersRef.current;
      if (!map.has(knowledgeBaseUuid)) {
        map.set(knowledgeBaseUuid, new Set());
      }
      map.get(knowledgeBaseUuid)!.add(listener);
      return () => {
        map.get(knowledgeBaseUuid)?.delete(listener);
      };
    },
    []
  );

  const notifyComplete = useCallback((knowledgeBaseUuid: string) => {
    listenersRef.current.get(knowledgeBaseUuid)?.forEach((fn) => fn());
    pendingOnCompleteRef.current?.();
    pendingOnCompleteRef.current = undefined;
  }, []);

  const finishProcessing = useCallback(
    (
      knowledgeBaseUuid: string,
      result: {
        allSucceeded: boolean;
        failedTasks: { file_name?: string; upload_id: number }[];
      }
    ) => {
      isProcessingRef.current = false;
      setIsUploadProcessing(false);
      setActiveJob(null);
      setProcessingTaskStatuses({});
      clearProcessingJob();
      pollCallbacksRef.current = null;
      notifyComplete(knowledgeBaseUuid);

      setCompleteAlert({
        open: true,
        variant: result.allSucceeded ? "success" : "partial",
        failedFileNames: result.failedTasks.map(
          (task) => task.file_name || String(task.upload_id)
        ),
      });
    },
    [notifyComplete]
  );

  const handleCompleteAlertOpenChange = useCallback((nextOpen: boolean) => {
    setCompleteAlert((prev) => ({ ...prev, open: nextOpen }));
    if (!nextOpen && !isProcessingRef.current) {
      setOpen(false);
      setSession(null);
    }
  }, []);

  const runJobPoll = useCallback(
    (job: PersistedProcessingJob) => {
      const taskIds = job.tasks.map((t) => t.taskId);
      const uploadIdByTaskId = new Map(
        job.tasks.map((t) => [t.taskId, t.uploadId])
      );

      runProcessingPoll({
        knowledgeBaseUuid: job.knowledgeBaseUuid,
        taskIds,
        uploadIdByTaskId,
        shouldAbort: () => pollAbortRef.current,
        onUpdate: (data) => {
          setProcessingTaskStatuses(data);
          pollCallbacksRef.current?.onUpdate(data);
        },
        onDone: (result) => {
          pollCallbacksRef.current?.onDone(result);
          finishProcessing(job.knowledgeBaseUuid, result);
        },
        onError: () => {
          pollCallbacksRef.current?.onError();
          isProcessingRef.current = false;
          setIsUploadProcessing(false);
          setActiveJob(null);
          setProcessingTaskStatuses({});
          clearProcessingJob();
          pollCallbacksRef.current = null;
          toast.error(tToast("genericWrong"), {
            description: tToast("statusCheckFailedTitle"),
          });
        },
      });
    },
    [finishProcessing, tToast]
  );

  const startProcessingJob = useCallback(
    (job: PersistedProcessingJob, callbacks: ProcessingPollCallbacks) => {
      saveProcessingJob(job);
      setActiveJob(job);
      isProcessingRef.current = true;
      setIsUploadProcessing(true);
      pollCallbacksRef.current = callbacks;
      runJobPoll(job);
    },
    [runJobPoll]
  );

  useEffect(() => {
    pollAbortRef.current = false;

    if (resumeStartedRef.current) return;
    const job = loadProcessingJob();
    if (!job) return;

    resumeStartedRef.current = true;
    toast.info(tToast("processingResumed"));
    setActiveJob(job);
    isProcessingRef.current = true;
    setIsUploadProcessing(true);
    runJobPoll(job);

    return () => {
      pollAbortRef.current = true;
    };
  }, [runJobPoll, tToast]);

  const openDocumentUpload = useCallback(
    (knowledgeBaseUuid: string, options?: OpenDocumentUploadOptions) => {
      pendingOnCompleteRef.current = options?.onComplete;
      setSession((prev) => {
        if (prev?.knowledgeBaseUuid === knowledgeBaseUuid && isProcessingRef.current) {
          return prev;
        }
        return {
          knowledgeBaseUuid,
          sessionKey: Date.now(),
          resumeMode: false,
        };
      });
      setOpen(true);
    },
    []
  );

  const openProcessingDialog = useCallback(() => {
    const job = activeJob ?? loadProcessingJob();
    if (!job) return;

    if (!activeJob) {
      setActiveJob(job);
      isProcessingRef.current = true;
      setIsUploadProcessing(true);
      runJobPoll(job);
    }

    setSession({
      knowledgeBaseUuid: job.knowledgeBaseUuid,
      sessionKey: Date.now(),
      resumeMode: true,
    });
    setOpen(true);
  }, [activeJob, runJobPoll]);

  const handleProcessingChange = useCallback((active: boolean) => {
    if (!active && !isProcessingRef.current) {
      setIsUploadProcessing(false);
    }
  }, []);

  const handleUploadComplete = useCallback(() => {
    if (session) {
      notifyComplete(session.knowledgeBaseUuid);
    }
    setOpen(false);
    if (!isProcessingRef.current) {
      setSession(null);
    }
    pendingOnCompleteRef.current = undefined;
  }, [session, notifyComplete]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setOpen(true);
      return;
    }
    setOpen(false);
    if (!isProcessingRef.current) {
      setSession(null);
      pendingOnCompleteRef.current = undefined;
    } else {
      setSession((prev) =>
        prev
          ? { ...prev, resumeMode: true }
          : activeJob
            ? {
                knowledgeBaseUuid: activeJob.knowledgeBaseUuid,
                sessionKey: Date.now(),
                resumeMode: true,
              }
            : null
      );
    }
  }, [activeJob]);

  const dialogKnowledgeBaseUuid =
    session?.knowledgeBaseUuid ?? activeJob?.knowledgeBaseUuid;
  const mountDialog = dialogKnowledgeBaseUuid != null;

  const value: DocumentUploadContextValue = {
    openDocumentUpload,
    openProcessingDialog,
    registerDocumentUploadComplete,
    startProcessingJob,
    isUploadDialogOpen: open,
    isUploadProcessing,
    activeProcessingJob: activeJob,
    processingTaskStatuses,
  };

  return (
    <DocumentUploadContext.Provider value={value}>
      {children}
      {mountDialog ? (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent forceMount className="gap-0 p-0 sm:max-w-3xl">
            <div className="border-b px-6 pt-6 pb-4">
              <DialogHeader>
                <DialogTitle>{t("addDocumentTitle")}</DialogTitle>
                <DialogDescription>
                  {t("addDocumentDescription")}
                </DialogDescription>
              </DialogHeader>
            </div>
            <DocumentUploadSteps
              key={session?.sessionKey ?? `resume-${dialogKnowledgeBaseUuid}`}
              layout="dialog"
              knowledgeBaseUuid={dialogKnowledgeBaseUuid!}
              onComplete={handleUploadComplete}
              onProcessingChange={handleProcessingChange}
              resumeJob={
                activeJob && (session?.resumeMode || !open) ? activeJob : null
              }
              sharedTaskStatuses={
                activeJob || isUploadProcessing
                  ? processingTaskStatuses
                  : undefined
              }
            />
          </DialogContent>
        </Dialog>
      ) : null}
      <DocumentProcessingCompleteAlert
        state={completeAlert}
        onOpenChange={handleCompleteAlertOpenChange}
      />
    </DocumentUploadContext.Provider>
  );
}
