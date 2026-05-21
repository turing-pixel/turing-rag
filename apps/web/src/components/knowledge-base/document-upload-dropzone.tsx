"use client";

import type { DropzoneRootProps } from "react-dropzone";
import { Upload } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type DocumentUploadDropzoneProps = {
  rootProps: DropzoneRootProps;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  title: string;
  hint: string;
  isDragActive: boolean;
};

export function DocumentUploadDropzone({
  rootProps,
  inputProps,
  title,
  hint,
  isDragActive,
}: DocumentUploadDropzoneProps) {
  return (
    <div
      {...rootProps}
      data-drag-active={isDragActive || undefined}
      className="cursor-pointer rounded-lg border border-dashed border-border transition-colors outline-none hover:border-primary hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring data-[drag-active]:border-primary data-[drag-active]:bg-primary/5"
    >
      <Empty>
        <input {...inputProps} />
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Upload />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{hint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
