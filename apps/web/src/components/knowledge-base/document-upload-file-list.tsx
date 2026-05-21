"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { DocumentFileIcon } from "@/components/knowledge-base/document-file-icon";
import { formatPipelineFileSize } from "@/lib/processing-task-status-ui";

export type UploadFileListItem = {
  file: File;
  status:
    | "pending"
    | "uploading"
    | "uploaded"
    | "processing"
    | "completed"
    | "error";
  error?: string;
};

type DocumentUploadFileListProps = {
  files: UploadFileListItem[];
  uploadedLabel: string;
  existsLabel: string;
  removeAriaLabel: string;
  onRemove: (file: File) => void;
};

function uploadStatusBadgeVariant(
  status: UploadFileListItem["status"]
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "uploaded") return "secondary";
  if (status === "error") return "destructive";
  if (status === "completed") return "outline";
  return "outline";
}

function uploadStatusLabel(
  file: UploadFileListItem,
  uploadedLabel: string,
  existsLabel: string
): string | null {
  if (file.status === "uploading" || file.status === "processing") return null;
  if (file.status === "uploaded") return uploadedLabel;
  if (file.status === "completed") return file.error || existsLabel;
  if (file.status === "error") return file.error ?? null;
  return null;
}

export function DocumentUploadFileList({
  files,
  uploadedLabel,
  existsLabel,
  removeAriaLabel,
  onRemove,
}: DocumentUploadFileListProps) {
  if (files.length === 0) return null;

  return (
    <ScrollArea>
      <ItemGroup>
        {files.map((fileStatus) => {
          const size = formatPipelineFileSize(fileStatus.file.size);
          const statusText = uploadStatusLabel(
            fileStatus,
            uploadedLabel,
            existsLabel
          );

          return (
            <Item key={fileStatus.file.name} variant="outline">
              <ItemMedia>
                <DocumentFileIcon fileName={fileStatus.file.name} size="lg" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{fileStatus.file.name}</ItemTitle>
                {size ? <ItemDescription>{size}</ItemDescription> : null}
              </ItemContent>
              <ItemActions>
                {fileStatus.status === "uploading" ||
                fileStatus.status === "processing" ? (
                  <Spinner />
                ) : statusText ? (
                  <Badge variant={uploadStatusBadgeVariant(fileStatus.status)}>
                    {statusText}
                  </Badge>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={removeAriaLabel}
                  onClick={() => onRemove(fileStatus.file)}
                >
                  <X />
                </Button>
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
    </ScrollArea>
  );
}
