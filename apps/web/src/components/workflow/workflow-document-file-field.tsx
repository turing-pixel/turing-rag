"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  WORKFLOW_DOCUMENT_ACCEPT,
  extractWorkflowDocumentText,
} from "@/lib/workflow-document";
import { cn } from "@/lib/utils";

interface WorkflowDocumentFileFieldProps {
  label: string;
  required?: boolean;
  value: string;
  fileName?: string | null;
  onChange: (text: string, meta?: { fileName: string | null }) => void;
  className?: string;
}

export function WorkflowDocumentFileField({
  label,
  required,
  value,
  fileName,
  onChange,
  className,
}: WorkflowDocumentFileFieldProps) {
  const t = useTranslations("dashboard.workflows.contractFile");
  const [uploadedName, setUploadedName] = useState<string | null>(fileName ?? null);
  const [extracting, setExtracting] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setExtracting(true);
      try {
        const result = await extractWorkflowDocumentText(file);
        setUploadedName(result.file_name);
        onChange(result.text, { fileName: result.file_name });
        toast.success(
          t("uploaded", {
            name: result.file_name,
            count: result.char_count.toLocaleString(),
          })
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("failed"));
      } finally {
        setExtracting(false);
      }
    },
    [onChange, t]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      const file = files[0];
      if (file) void handleFile(file);
    },
    accept: WORKFLOW_DOCUMENT_ACCEPT,
    maxFiles: 1,
    disabled: extracting,
  });

  const clearFile = () => {
    setUploadedName(null);
    onChange("", { fileName: null });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>

      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-lg border border-dashed border-border/80 bg-muted/15 px-4 py-5 text-center transition-colors outline-none",
          "hover:border-primary/40 hover:bg-muted/25",
          isDragActive && "border-primary/50 bg-primary/5",
          extracting && "pointer-events-none opacity-70"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {extracting ? (
            <Loader2 className="size-8 animate-spin text-primary" />
          ) : (
            <Upload className="size-8 text-muted-foreground" strokeWidth={1.5} />
          )}
          <p className="text-sm font-medium">
            {extracting ? t("extracting") : t("upload")}
          </p>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>
      </div>

      {uploadedName ? (
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{uploadedName}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={clearFile}
            aria-label={t("remove")}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{t("editHint")}</p>
        <Textarea
          rows={10}
          value={value}
          onChange={(e) => onChange(e.target.value, { fileName: uploadedName })}
          placeholder={t("placeholder")}
        />
      </div>
    </div>
  );
}
