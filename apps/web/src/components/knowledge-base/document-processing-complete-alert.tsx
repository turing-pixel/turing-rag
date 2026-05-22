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
      <AlertDialogContent size="default" className="sm:max-w-lg">
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
            <div className="w-full space-y-3 text-left">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
              {!isSuccess && state.failedFileNames.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-destructive/15 bg-destructive/4">
                  <p className="border-b border-destructive/10 px-3 py-2 text-xs font-medium text-foreground">
                    {tPage("processingFailedFilesLabel")}
                  </p>
                  <ul className="max-h-40 divide-y divide-border/50 overflow-y-auto">
                    {state.failedFileNames.map((name, index) => (
                      <li
                        key={`${name}-${index}`}
                        className="px-3 py-2 text-xs leading-relaxed wrap-break-word text-muted-foreground"
                      >
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
