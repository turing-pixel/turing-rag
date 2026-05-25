import { api } from "@/lib/api";

export type WorkflowDocumentExtractResult = {
  text: string;
  file_name: string;
  char_count: number;
};

export async function extractWorkflowDocumentText(
  file: File
): Promise<WorkflowDocumentExtractResult> {
  const form = new FormData();
  form.append("file", file);
  return api.post(
    "/api/workflows/extract-document-text",
    form
  ) as Promise<WorkflowDocumentExtractResult>;
}

export const WORKFLOW_DOCUMENT_ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
} as const;
