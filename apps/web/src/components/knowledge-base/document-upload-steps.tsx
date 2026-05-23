"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Upload, Settings, FileText, Check, ChevronLeft } from "lucide-react";
import { DocumentProcessingPipelineList } from "@/components/knowledge-base/document-processing-pipeline-list";
import { DocumentUploadDropzone } from "@/components/knowledge-base/document-upload-dropzone";
import { DocumentUploadFileList } from "@/components/knowledge-base/document-upload-file-list";
import { DocumentUploadPreviewPanel } from "@/components/knowledge-base/document-upload-preview-panel";
import { useDocumentUpload } from "@/components/knowledge-base/document-upload-provider";
import { api, ApiError } from "@/lib/api";
import {
  mergeTaskStatusMaps,
  type ProcessingTaskStatusMap,
} from "@/lib/document-processing-poll";
import type { PersistedProcessingJob } from "@/lib/document-upload-persistence";
import { useDropzone } from "react-dropzone";
import {
  Stepper,
  StepperConnector,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperTitle,
  StepperTrack,
} from "@/components/ui/stepper";

interface DocumentUploadStepsProps {
  knowledgeBaseUuid: string;
  onComplete?: () => void;
  /** Fired when background document processing starts or finishes. */
  onProcessingChange?: (active: boolean) => void;
  /** Restore step 3 UI after refresh / reopening dialog. */
  resumeJob?: PersistedProcessingJob | null;
  /** Live task statuses from global processing poll. */
  sharedTaskStatuses?: ProcessingTaskStatusMap;
  /** When true, action buttons render in DialogFooter (for modal layout). */
  layout?: "dialog" | "inline";
}

function createFileEntryId(seed?: { uploadId?: number; taskId?: number }): string {
  if (seed?.uploadId != null && seed?.taskId != null) {
    return `upload-${seed.uploadId}-task-${seed.taskId}`;
  }
  if (seed?.uploadId != null) return `upload-${seed.uploadId}`;
  if (seed?.taskId != null) return `task-${seed.taskId}`;
  return crypto.randomUUID();
}

interface FileStatus {
  id: string;
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
  documentId?: number;
  tempPath?: string;
  error?: string;
}

interface UploadResult {
  upload_id?: number;
  document_id?: number;
  file_name: string;
  status: "exists" | "pending";
  message?: string;
  skip_processing: boolean;
  temp_path?: string;
}

interface PreviewChunk {
  content: string;
  metadata: Record<string, unknown>;
}

interface PreviewResponse {
  chunks: PreviewChunk[];
  total_chunks: number;
}

interface TaskResponse {
  tasks: Array<{
    upload_id: number;
    task_id: number;
  }>;
}

interface TaskStatus {
  document_id: number | null;
  upload_id: number;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  progress_message?: string | null;
  error_message?: string;
  file_name?: string;
}

interface TaskStatusMap {
  [key: number]: TaskStatus;
}

const STEP_ITEMS = [
  { step: 1 as const, icon: Upload, labelKey: "stepUpload" as const },
  { step: 2 as const, icon: FileText, labelKey: "stepPreview" as const },
  { step: 3 as const, icon: Settings, labelKey: "stepProcess" as const },
];

export function DocumentUploadSteps({
  knowledgeBaseUuid,
  onComplete,
  onProcessingChange,
  resumeJob = null,
  sharedTaskStatuses,
  layout = "dialog",
}: DocumentUploadStepsProps) {
  const { startProcessingJob, isUploadProcessing } = useDocumentUpload();
  const [currentStep, setCurrentStep] = useState(1);
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<{
    [key: number]: PreviewResponse;
  }>({});
  const [selectedPreviewFileId, setSelectedPreviewFileId] = useState<
    string | null
  >(null);
  const [taskStatuses, setTaskStatuses] = useState<{
    [key: number]: TaskStatus;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const tToast = useTranslations("toasts");
  const tStep = useTranslations("uploadSteps");
  const tStatus = useTranslations("processingStatus");

  const syncFilesFromTaskStatuses = useCallback(
    (statuses: TaskStatusMap) => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.status !== "uploaded" && f.status !== "processing") {
            return f;
          }
          const task = Object.values(statuses).find(
            (t) => t.upload_id === f.uploadId
          );
          if (!task) return f;

          if (task.status === "completed") {
            return {
              ...f,
              status: "completed",
              documentId: task.document_id ?? f.documentId,
              error: undefined,
            };
          }
          if (task.status === "failed") {
            return {
              ...f,
              status: "error",
              error: task.error_message || tToast("genericWrong"),
            };
          }
          return { ...f, status: "processing" };
        })
      );
    },
    [tToast]
  );

  useEffect(() => {
    if (!resumeJob) return;
    setCurrentStep(3);
    setFiles((prev) => {
      if (prev.length >= resumeJob.tasks.length) return prev;
      return resumeJob.tasks.map((t) => ({
        id: createFileEntryId({ uploadId: t.uploadId, taskId: t.taskId }),
        file: new File([], t.fileName ?? `Document ${t.uploadId}`),
        status: "processing" as const,
        uploadId: t.uploadId,
        taskId: t.taskId,
      }));
    });
  }, [resumeJob]);

  useEffect(() => {
    if (!sharedTaskStatuses || Object.keys(sharedTaskStatuses).length === 0) {
      return;
    }
    setTaskStatuses(sharedTaskStatuses);
    if (resumeJob) {
      setFiles(
        resumeJob.tasks.map((t) => {
          const task = Object.values(sharedTaskStatuses).find(
            (s) => s.upload_id === t.uploadId
          );
          const name =
            task?.file_name ?? t.fileName ?? `Document ${t.uploadId}`;
          let status: FileStatus["status"] = "processing";
          if (task?.status === "completed") status = "completed";
          if (task?.status === "failed") status = "error";
          return {
            id: createFileEntryId({ uploadId: t.uploadId, taskId: t.taskId }),
            file: new File([], name),
            status,
            uploadId: t.uploadId,
            taskId: t.taskId,
            documentId: task?.document_id ?? undefined,
            error: task?.error_message,
          };
        })
      );
    } else {
      syncFilesFromTaskStatuses(sharedTaskStatuses);
    }
  }, [sharedTaskStatuses, resumeJob, syncFilesFromTaskStatuses]);

  const getErrorMessage = (error: unknown) =>
    error instanceof ApiError ? error.message : tToast("genericWrong");

  const formatTaskStatus = (raw: string | undefined) => {
    const s = raw || "pending";
    if (
      s === "pending" ||
      s === "processing" ||
      s === "completed" ||
      s === "failed"
    ) {
      return tStatus(s);
    }
    return s;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...acceptedFiles.map((file) => ({
        id: createFileEntryId(),
        file,
        status: "pending" as const,
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      const messages = rejections.flatMap((r) =>
        r.errors.map((e) => e.message)
      );
      toast.error(
        messages[0] ? messages.join("; ") : tStep("fileRejected")
      );
    },
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
    },
    maxSize: 50 * 1024 * 1024,
    disabled: isLoading,
  });

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== file));
  };

  const handleFileUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) {
      toast.error(tToast("uploadMissing"));
      return;
    }

    const pendingFileRefs = new Set(pendingFiles.map((f) => f.file));

    setIsLoading(true);
    setFiles((prev) =>
      prev.map((f) =>
        pendingFileRefs.has(f.file)
          ? { ...f, status: "uploading" as const }
          : f
      )
    );

    try {
      const formData = new FormData();
      pendingFiles.forEach((fileStatus) => {
        formData.append("files", fileStatus.file);
      });

      const raw = await api.post(
        `/api/knowledge-base/${knowledgeBaseUuid}/documents/upload`,
        formData,
        {
          headers: {},
        }
      );

      const data = (Array.isArray(raw) ? raw : []) as UploadResult[];

      const resultByFile = new Map<File, UploadResult>();
      pendingFiles.forEach((fileStatus, index) => {
        const uploadResult = data[index];
        if (uploadResult) {
          resultByFile.set(fileStatus.file, uploadResult);
        }
      });

      const newUploads = data.filter((d) => d.status !== "exists");
      const existsCount = data.filter((d) => d.status === "exists").length;
      const missingCount = pendingFiles.filter(
        (f) => !resultByFile.has(f.file)
      ).length;

      let firstSelectedPreviewId: string | null = null;

      setFiles((prev) =>
        prev.map((f) => {
          if (!pendingFileRefs.has(f.file)) return f;

          const uploadResult = resultByFile.get(f.file);
          if (!uploadResult) {
            return {
              ...f,
              status: "error",
              error: tStep("uploadNoResponse"),
            };
          }
          if (uploadResult.status === "exists") {
            return {
              ...f,
              status: "completed",
              documentId: uploadResult.document_id,
              error: uploadResult.message,
            };
          }
          if (
            firstSelectedPreviewId == null &&
            uploadResult.upload_id != null
          ) {
            firstSelectedPreviewId = f.id;
          }
          return {
            ...f,
            status: "uploaded",
            uploadId: uploadResult.upload_id,
            tempPath: uploadResult.temp_path,
          };
        })
      );

      if (newUploads.length > 0) {
        if (firstSelectedPreviewId != null) {
          setSelectedPreviewFileId(firstSelectedPreviewId);
        }
        setCurrentStep(2);
        toast.success(tToast("uploadSuccessDesc", { count: newUploads.length }));
        if (existsCount > 0) {
          toast.info(tToast("uploadSkippedExists", { count: existsCount }));
        }
        if (missingCount > 0) {
          toast.error(tToast("uploadPartialFailed", { count: missingCount }));
        }
      } else if (existsCount > 0 && missingCount === 0) {
        toast.info(tToast("uploadAllExist"));
        onComplete?.();
      } else if (missingCount > 0) {
        toast.error(tToast("uploadPartialFailed", { count: missingCount }));
      }
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading"
            ? {
                ...f,
                status: "error",
                error: getErrorMessage(error),
              }
            : f
        )
      );
      toast.error(getErrorMessage(error), {
        description: tToast("uploadFailedTitle"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async () => {
    const selectedFile = files.find((f) => f.id === selectedPreviewFileId);
    const previewDocumentId =
      selectedFile?.documentId ?? selectedFile?.uploadId ?? null;
    if (!selectedFile || previewDocumentId == null) return;

    if (
      !Number.isFinite(chunkSize) ||
      !Number.isFinite(chunkOverlap) ||
      chunkSize <= 0 ||
      chunkOverlap < 0 ||
      chunkOverlap >= chunkSize
    ) {
      toast.error(tStep("chunkSettingsInvalid"));
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.post(
        `/api/knowledge-base/${knowledgeBaseUuid}/documents/preview`,
        {
          document_ids: [previewDocumentId],
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap,
        }
      );

      setUploadedDocuments(data);
      toast.success(tToast("previewGeneratedDesc"));
    } catch (error) {
      toast.error(getErrorMessage(error), {
        description: tToast("previewFailedTitle"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcess = async (uploadResults?: UploadResult[]) => {
    const resultsToProcess =
      uploadResults ||
      files
        .filter((f) => f.status === "uploaded" && f.uploadId != null)
        .map((f) => ({
          upload_id: f.uploadId!,
          file_name: f.file.name,
          status: "pending" as const,
          skip_processing: false,
          temp_path: f.tempPath!,
        }));

    if (resultsToProcess.length === 0) {
      toast.error(tToast("noFilesToProcess"));
      return;
    }

    setIsLoading(true);
    onProcessingChange?.(true);

    try {
      const data = (await api.post(
        `/api/knowledge-base/${knowledgeBaseUuid}/documents/process`,
        resultsToProcess
      )) as TaskResponse;

      if (!data.tasks?.length) {
        setIsLoading(false);
        onProcessingChange?.(false);
        toast.error(tToast("uploadProcessStartFailed"));
        setFiles((prev) =>
          prev.map((f) =>
            f.status === "processing" ? { ...f, status: "uploaded" as const } : f
          )
        );
        return;
      }

      const initialStatuses = data.tasks.reduce<TaskStatusMap>(
        (acc, task) => ({
          ...acc,
          [task.task_id]: {
            upload_id: task.upload_id,
            progress: 0,
            document_id: null,
            status: "pending" as const,
          },
        }),
        {}
      );
      setTaskStatuses(initialStatuses);
      setFiles((prev) =>
        prev.map((f) => {
          const match = data.tasks.find((t) => t.upload_id === f.uploadId);
          if (match && (f.status === "uploaded" || f.status === "processing")) {
            return {
              ...f,
              status: "processing" as const,
              taskId: match.task_id,
            };
          }
          return f;
        })
      );
      const job: PersistedProcessingJob = {
        knowledgeBaseUuid,
        tasks: data.tasks.map((t) => {
          const file = files.find((f) => f.uploadId === t.upload_id);
          return {
            taskId: t.task_id,
            uploadId: t.upload_id,
            fileName: file?.file.name,
          };
        }),
        startedAt: Date.now(),
      };
      startProcessingJob(job, {
        onUpdate: (statuses) => {
          setTaskStatuses(statuses);
          syncFilesFromTaskStatuses(statuses);
        },
        onDone: ({ allSucceeded }) => {
          setIsLoading(false);
          onProcessingChange?.(false);
          if (allSucceeded) {
            onComplete?.();
          }
        },
        onError: () => {
          setIsLoading(false);
          onProcessingChange?.(false);
        },
      });
    } catch (error) {
      setIsLoading(false);
      onProcessingChange?.(false);
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "processing"
            ? {
                ...f,
                status: "error",
                error: getErrorMessage(error),
              }
            : f
        )
      );
      toast.error(getErrorMessage(error), {
        description: tToast("processingFailedTitle"),
      });
    }
  };

  const handleProcessClick = (e: React.MouseEvent) => {
    e.preventDefault();
    handleProcess();
  };

  const effectiveTaskStatuses = useMemo(
    () => mergeTaskStatusMaps(sharedTaskStatuses, taskStatuses),
    [sharedTaskStatuses, taskStatuses]
  );

  const resumeTaskList = resumeJob?.tasks;

  const hasActiveProcessingTasks = Object.values(effectiveTaskStatuses).some(
    (t) => t.status === "pending" || t.status === "processing"
  );

  const isStep3Processing =
    isUploadProcessing || isLoading || hasActiveProcessingTasks;

  const uploadedFiles = files.filter((f) => f.status === "uploaded");
  const pipelineFiles = files.filter(
    (f) =>
      f.uploadId != null &&
      (f.status === "uploaded" ||
        f.status === "processing" ||
        f.status === "completed" ||
        f.status === "error")
  );
  const hasPendingFiles = files.some((f) => f.status === "pending");
  const selectedPreviewFile = uploadedFiles.find(
    (f) => f.id === selectedPreviewFileId
  );
  const previewLookupId =
    selectedPreviewFile?.documentId ?? selectedPreviewFile?.uploadId ?? null;
  const previewData =
    previewLookupId != null ? uploadedDocuments[previewLookupId] : undefined;

  const renderStepFooter = () => {
    if (currentStep === 1) {
      return (
        <Button
          type="button"
          onClick={handleFileUpload}
          disabled={!hasPendingFiles || isLoading}
        >
          {isLoading ? <Spinner /> : null}
          {tStep("uploadFiles")}
        </Button>
      );
    }

    if (currentStep === 2) {
      return (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={isLoading || !selectedPreviewFileId}
          >
            {isLoading ? <Spinner /> : null}
            {tStep("previewChunks")}
          </Button>
          <Button
            type="button"
            onClick={() => setCurrentStep(3)}
            disabled={isLoading}
          >
            {tStep("continue")}
          </Button>
        </>
      );
    }

    return (
      <Button
        type="button"
        onClick={handleProcessClick}
        disabled={isStep3Processing || uploadedFiles.length === 0}
      >
        {isStep3Processing ? (
          <>
            <Spinner />
            {tStep("processing")}
          </>
        ) : (
          <>
            <Settings data-icon="inline-start" aria-hidden />
            {tStep("process")}
          </>
        )}
      </Button>
    );
  };

  const footerActions = renderStepFooter();

  const footer =
    currentStep > 1 ? (
      <div className="flex w-full items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isLoading || (currentStep === 3 && isStep3Processing)}
          onClick={() => setCurrentStep((s) => s - 1)}
        >
          <ChevronLeft data-icon="inline-start" aria-hidden />
          {tStep("back")}
        </Button>
        <div className="flex items-center gap-2">{footerActions}</div>
      </div>
    ) : (
      <div className="flex w-full justify-end">{footerActions}</div>
    );

  const stepContent = (
    <div className="flex flex-col gap-6">
      <Stepper
        value={currentStep}
        stepCount={STEP_ITEMS.length}
        aria-label={tStep("stepsNavAria")}
      >
        <StepperList>
          {STEP_ITEMS.map(({ step: stepNum, icon: Icon, labelKey }) => (
              <StepperItem key={stepNum} step={stepNum}>
                <StepperTrack>
                  <StepperConnector position="leading" />
                  <StepperIndicator
                    completedIcon={<Check aria-hidden />}
                    aria-label={`${stepNum}. ${tStep(labelKey)}${currentStep > stepNum ? ` (${tStatus("completed")})` : ""}`}
                  >
                    <Icon aria-hidden />
                  </StepperIndicator>
                  <StepperConnector position="trailing" />
                </StepperTrack>
                <StepperTitle>{tStep(labelKey)}</StepperTitle>
              </StepperItem>
          ))}
        </StepperList>
      </Stepper>

      {currentStep === 1 && (
        <div className="flex flex-col gap-4">
          <DocumentUploadDropzone
            rootProps={getRootProps()}
            inputProps={getInputProps()}
            title={tStep("dropzoneTitle")}
            hint={tStep("dropzoneHint")}
            isDragActive={isDragActive}
          />
          <DocumentUploadFileList
            files={files}
            uploadedLabel={tStep("uploaded")}
            existsLabel={tStep("existsSkipped")}
            removeAriaLabel={tStep("removeFileAria")}
            onRemove={removeFile}
          />
        </div>
      )}

      {currentStep === 2 && (
        <DocumentUploadPreviewPanel
          documents={uploadedFiles.map((f) => ({
            id: f.id,
            uploadId: f.uploadId!,
            fileName: f.file.name,
          }))}
          selectedFileId={selectedPreviewFileId}
          onSelectFileId={setSelectedPreviewFileId}
          chunkSize={chunkSize}
          chunkOverlap={chunkOverlap}
          onChunkSizeChange={setChunkSize}
          onChunkOverlapChange={setChunkOverlap}
          previewFileName={selectedPreviewFile?.file.name}
          chunks={previewData?.chunks ?? []}
          labels={{
            previewHeading: tStep("previewHeading"),
            selectPlaceholder: tStep("selectDocPlaceholder"),
            advancedSettings: tStep("advancedSettings"),
            chunkSize: tStep("chunkSize"),
            chunkOverlap: tStep("chunkOverlap"),
            chunksCount: (count) => tStep("chunksCount", { count }),
            chunkLabel: (index) => tStep("chunkLabel", { index }),
          }}
        />
      )}

      {currentStep === 3 && (
        <DocumentProcessingPipelineList
          files={pipelineFiles}
          taskStatuses={effectiveTaskStatuses}
          resumeTasks={resumeTaskList}
          formatStatus={formatTaskStatus}
          progressAriaLabel={tStep("processingProgressAria")}
        />
      )}
    </div>
  );

  if (layout === "dialog") {
    return (
      <>
        <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-6 py-4">
          {stepContent}
        </div>
        <DialogFooter>
          <div className="w-full border-t px-6 pt-4 pb-6">{footer}</div>
        </DialogFooter>
      </>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {stepContent}
      <DialogFooter>{footer}</DialogFooter>
    </div>
  );
}
