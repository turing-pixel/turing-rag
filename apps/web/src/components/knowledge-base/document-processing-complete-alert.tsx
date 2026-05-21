"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ProcessingCompleteAlertState = {
  open: boolean;
  variant: "success" | "partial";
  failedFileNames: string[];
};

type DocumentProcessingCompleteAlertProps = {
  state: ProcessingCompleteAlertState;
  onOpenChange: (open: boolean) => void;
};

export function DocumentProcessingCompleteAlert({
  state,
  onOpenChange,
}: DocumentProcessingCompleteAlertProps) {
  const tToast = useTranslations("toasts");
  const tPage = useTranslations("knowledgePage");

  const isSuccess = state.variant === "success";
  const title = isSuccess
    ? tToast("processingDoneTitle")
    : tToast("processingPartialTitle");
  const description = isSuccess
    ? tToast("processingDoneDesc")
    : tToast("processingPartialDesc");

  return (
    <AlertDialog open={state.open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default" className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia
            className={
              isSuccess
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            }
          >
            {isSuccess ? (
              <CheckCircle2 aria-hidden />
            ) : (
              <AlertCircle aria-hidden />
            )}
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>{description}</p>
              {!isSuccess && state.failedFileNames.length > 0 && (
                <div className="rounded-md border bg-muted/40 px-3 py-2">
                  <p className="mb-1.5 text-xs font-medium text-foreground">
                    {tPage("processingFailedFilesLabel")}
                  </p>
                  <ul className="max-h-32 list-inside list-disc space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                    {state.failedFileNames.map((name) => (
                      <li key={name} className="truncate">
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>{tPage("processingAlertOk")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
