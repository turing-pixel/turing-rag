"use client";

import { useState, useCallback, useEffect } from "react";
import { FileIcon, defaultStyles } from "react-file-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  X,
  Settings,
  FileText,
  Check,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocumentUpload } from "@/components/knowledge-base/document-upload-provider";
import { api, ApiError } from "@/lib/api";
import type { ProcessingTaskStatusMap } from "@/lib/document-processing-poll";
import type { PersistedProcessingJob } from "@/lib/document-upload-persistence";
import { useDropzone } from "react-dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  knowledgeBaseId: number;
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

interface FileStatus {
  file: File;
  status:
    | "pending"
    | "uploading"
    | "uploaded"
    | "processing"
    | "completed"
    | "error";
  uploadId?: number;
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
  knowledgeBaseId,
  onComplete,
  onProcessingChange,
  resumeJob = null,
  sharedTaskStatuses,
  layout = "dialog",
}: DocumentUploadStepsProps) {
  const { startProcessingJob } = useDocumentUpload();
  const [currentStep, setCurrentStep] = useState(1);
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<{
    [key: number]: PreviewResponse;
  }>({});
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    null
  );
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
          const name = task?.file_name ?? `Document ${t.uploadId}`;
          let status: FileStatus["status"] = "processing";
          if (task?.status === "completed") status = "completed";
          if (task?.status === "failed") status = "error";
          return {
            file: new File([], name),
            status,
            uploadId: t.uploadId,
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

  const normalizeFileName = (name: string) =>
    name.split(/[/\\]/).pop() ?? name;

  const handleFileUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) {
      toast.error(tToast("uploadMissing"));
      return;
    }

    const pendingNames = new Set(
      pendingFiles.map((f) => normalizeFileName(f.file.name))
    );

    setIsLoading(true);
    setFiles((prev) =>
      prev.map((f) =>
        pendingNames.has(normalizeFileName(f.file.name))
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
        `/api/knowledge-base/${knowledgeBaseId}/documents/upload`,
        formData,
        {
          headers: {},
        }
      );

      const data = (Array.isArray(raw) ? raw : []) as UploadResult[];

      const resultByName = new Map(
        data.map((d) => [normalizeFileName(d.file_name), d])
      );
      const newUploads = data.filter((d) => d.status !== "exists");
      const existsCount = data.filter((d) => d.status === "exists").length;
      const missingCount = pendingFiles.filter(
        (f) => !resultByName.has(normalizeFileName(f.file.name))
      ).length;

      let firstUploadId: number | null = null;
      for (const item of newUploads) {
        if (item.upload_id != null && firstUploadId == null) {
          firstUploadId = item.upload_id;
        }
      }

      setFiles((prev) =>
        prev.map((f) => {
          const key = normalizeFileName(f.file.name);
          if (!pendingNames.has(key)) return f;

          const uploadResult = resultByName.get(key);
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
          return {
            ...f,
            status: "uploaded",
            uploadId: uploadResult.upload_id,
            tempPath: uploadResult.temp_path,
          };
        })
      );

      if (newUploads.length > 0) {
        if (firstUploadId != null) {
          setSelectedDocumentId(firstUploadId);
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
    const selectedFile = files.find(
      (f) =>
        f.documentId === selectedDocumentId || f.uploadId === selectedDocumentId
    );
    if (!selectedFile || selectedDocumentId == null) return;

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
        `/api/knowledge-base/${knowledgeBaseId}/documents/preview`,
        {
          document_ids: [selectedDocumentId],
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
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "uploaded" ? { ...f, status: "processing" as const } : f
      )
    );

    try {
      const data = (await api.post(
        `/api/knowledge-base/${knowledgeBaseId}/documents/process`,
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
            document_id: null,
            status: "pending" as const,
          },
        }),
        {}
      );
      setTaskStatuses(initialStatuses);
      const job: PersistedProcessingJob = {
        knowledgeBaseId,
        tasks: data.tasks.map((t) => ({
          taskId: t.task_id,
          uploadId: t.upload_id,
        })),
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

  const uploadedFiles = files.filter((f) => f.status === "uploaded");
  const pipelineFiles = files.filter(
    (f) =>
      f.uploadId != null &&
      (f.status === "uploaded" ||
        f.status === "processing" ||
        f.status === "error")
  );
  const hasPendingFiles = files.some((f) => f.status === "pending");
  const previewData =
    selectedDocumentId != null
      ? uploadedDocuments[selectedDocumentId]
      : undefined;

  const renderStepFooter = () => {
    if (currentStep === 1) {
      return (
        <Button
          type="button"
          onClick={handleFileUpload}
          disabled={!hasPendingFiles || isLoading}
        >
          {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
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
            disabled={isLoading || !selectedDocumentId}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
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
        disabled={isLoading || uploadedFiles.length === 0}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            {tStep("processing")}
          </>
        ) : (
          <>
            <Settings className="mr-2 size-4" />
            {tStep("process")}
          </>
        )}
      </Button>
    );
  };

  const footer = (
    <div
      className={cn(
        "flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center",
        currentStep > 1 ? "sm:justify-between" : "sm:justify-end"
      )}
    >
      {currentStep > 1 && (
        <Button
          type="button"
          variant="ghost"
          className="w-full sm:w-auto"
          disabled={isLoading}
          onClick={() => setCurrentStep((s) => s - 1)}
        >
          <ChevronLeft className="mr-1 size-4" aria-hidden />
          {tStep("back")}
        </Button>
      )}
      <div className="flex w-full flex-col-reverse gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:justify-end">
        {renderStepFooter()}
      </div>
    </div>
  );

  const stepContent = (
    <>
      <Stepper
        value={currentStep}
        stepCount={STEP_ITEMS.length}
        aria-label={tStep("stepsNavAria")}
        className="mb-6"
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
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              "rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">{tStep("dropzoneTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tStep("dropzoneHint")}
            </p>
          </div>

          {files.length > 0 && (
            <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
              {files.map((fileStatus) => (
                <li
                  key={fileStatus.file.name}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="size-7 shrink-0">
                      <FileIcon
                        extension={fileStatus.file.name.split(".").pop()}
                        {...defaultStyles[
                          fileStatus.file.name
                            .split(".")
                            .pop() as keyof typeof defaultStyles
                        ]}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {fileStatus.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {fileStatus.status === "uploading" && (
                      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    )}
                    {fileStatus.status === "uploaded" && (
                      <span className="text-xs text-green-600 dark:text-green-500">
                        {tStep("uploaded")}
                      </span>
                    )}
                    {fileStatus.status === "completed" && (
                      <span className="text-xs text-muted-foreground">
                        {fileStatus.error || tStep("existsSkipped")}
                      </span>
                    )}
                    {fileStatus.status === "error" && (
                      <span
                        className="max-w-48 truncate text-xs text-destructive"
                        title={fileStatus.error}
                      >
                        {fileStatus.error}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={tStep("removeFileAria")}
                      onClick={() => removeFile(fileStatus.file)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">
              {tStep("previewHeading")}
            </Label>
            <Select
              value={selectedDocumentId?.toString()}
              onValueChange={(value: string) =>
                setSelectedDocumentId(parseInt(value))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={tStep("selectDocPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {uploadedFiles.map((f) => (
                  <SelectItem key={f.uploadId} value={f.uploadId!.toString()}>
                    {f.file.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="settings" className="border-b-0">
              <AccordionTrigger className="py-2 text-sm hover:no-underline">
                {tStep("advancedSettings")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="chunk-size">{tStep("chunkSize")}</Label>
                    <Input
                      id="chunk-size"
                      type="number"
                      value={chunkSize}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) setChunkSize(n);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chunk-overlap">{tStep("chunkOverlap")}</Label>
                    <Input
                      id="chunk-overlap"
                      type="number"
                      value={chunkOverlap}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) setChunkOverlap(n);
                      }}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {previewData && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">
                  {
                    files.find((f) => f.uploadId === selectedDocumentId)?.file
                      .name
                  }
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {tStep("chunksCount", { count: previewData.chunks.length })}
                </span>
              </div>
              <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
                {previewData.chunks.map((chunk: PreviewChunk, index: number) => (
                  <div key={index} className="px-3 py-3">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {tStep("chunkLabel", { index: index + 1 })}
                    </p>
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                      {chunk.content}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === 3 && (
        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
          {pipelineFiles.map((file) => {
            const task = Object.values(taskStatuses).find(
              (t) => t.upload_id === file.uploadId
            );
            return (
              <li key={file.uploadId} className="space-y-2 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="size-7 shrink-0">
                      <FileIcon
                        extension={file.file.name.split(".").pop()}
                        {...defaultStyles[
                          file.file.name
                            .split(".")
                            .pop() as keyof typeof defaultStyles
                        ]}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {file.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(file.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {task && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {(task.status === "pending" ||
                            task.status === "processing") && (
                            <Loader2
                              className="size-3 shrink-0 animate-spin"
                              aria-hidden
                            />
                          )}
                          {tStep("statusLabel", {
                            status: formatTaskStatus(task.status),
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  {(task?.status === "failed" || file.status === "error") && (
                    <p
                      className="max-w-48 shrink-0 truncate text-xs text-destructive"
                      title={task?.error_message || file.error}
                    >
                      {task?.error_message || file.error}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  if (layout === "dialog") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-4">
          {stepContent}
        </div>
        <DialogFooter className="shrink-0 gap-0 border-t px-6 py-4 sm:gap-0">
          {footer}
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {stepContent}
      <div className="border-t pt-4">{footer}</div>
    </div>
  );
}
