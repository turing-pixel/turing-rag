"use client";

import { DocumentUploadProvider } from "@/components/knowledge-base/document-upload-provider";

export function LocaleProviders({ children }: { children: React.ReactNode }) {
  return <DocumentUploadProvider>{children}</DocumentUploadProvider>;
}
