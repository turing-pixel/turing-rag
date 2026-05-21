export type ProcessingTaskStatusValue =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export function processingStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "secondary";
  if (status === "failed") return "destructive";
  if (status === "pending" || status === "processing") return "outline";
  return "default";
}

export function formatPipelineFileSize(bytes: number): string | null {
  if (bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
