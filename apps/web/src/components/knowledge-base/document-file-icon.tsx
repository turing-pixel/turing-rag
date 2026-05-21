"use client";

import { FileIcon } from "react-file-icon";
import { cn } from "@/lib/utils";
import { getDocumentFileIconProps } from "@/lib/document-file-icon";

interface DocumentFileIconProps {
  fileName: string;
  contentType?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "size-7",
  md: "size-8",
  lg: "size-10",
} as const;

export function DocumentFileIcon({
  fileName,
  contentType,
  size = "md",
  className,
}: DocumentFileIconProps) {
  return (
    <div
      className={cn("shrink-0 [&_svg]:size-full", sizeClasses[size], className)}
      aria-hidden
    >
      <FileIcon {...getDocumentFileIconProps(fileName, contentType)} />
    </div>
  );
}
