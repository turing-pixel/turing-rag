"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export type PreviewChunk = {
  content: string;
  metadata: Record<string, unknown>;
};

export type PreviewDocumentOption = {
  uploadId: number;
  fileName: string;
};

type DocumentUploadPreviewPanelProps = {
  documents: PreviewDocumentOption[];
  selectedUploadId: number | null;
  onSelectUploadId: (uploadId: number) => void;
  chunkSize: number;
  chunkOverlap: number;
  onChunkSizeChange: (value: number) => void;
  onChunkOverlapChange: (value: number) => void;
  previewFileName?: string;
  chunks: PreviewChunk[];
  labels: {
    previewHeading: string;
    selectPlaceholder: string;
    advancedSettings: string;
    chunkSize: string;
    chunkOverlap: string;
    chunksCount: (count: number) => string;
    chunkLabel: (index: number) => string;
  };
};

export function DocumentUploadPreviewPanel({
  documents,
  selectedUploadId,
  onSelectUploadId,
  chunkSize,
  chunkOverlap,
  onChunkSizeChange,
  onChunkOverlapChange,
  previewFileName,
  chunks,
  labels,
}: DocumentUploadPreviewPanelProps) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{labels.previewHeading}</FieldLabel>
        <Select
          value={selectedUploadId?.toString()}
          onValueChange={(value) => onSelectUploadId(parseInt(value, 10))}
        >
          <SelectTrigger>
            <SelectValue placeholder={labels.selectPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {documents.map((doc) => (
              <SelectItem key={doc.uploadId} value={doc.uploadId.toString()}>
                {doc.fileName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Accordion type="single" collapsible>
        <AccordionItem value="settings">
          <AccordionTrigger>{labels.advancedSettings}</AccordionTrigger>
          <AccordionContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="chunk-size">{labels.chunkSize}</FieldLabel>
                  <Input
                    id="chunk-size"
                    type="number"
                    value={chunkSize}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isNaN(n)) onChunkSizeChange(n);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="chunk-overlap">
                    {labels.chunkOverlap}
                  </FieldLabel>
                  <Input
                    id="chunk-overlap"
                    type="number"
                    value={chunkOverlap}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isNaN(n)) onChunkOverlapChange(n);
                    }}
                  />
                </Field>
              </div>
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {chunks.length > 0 && previewFileName ? (
        <>
          <Separator />
          <Card size="sm">
            <CardHeader>
              <CardTitle>{previewFileName}</CardTitle>
              <CardDescription>
                {labels.chunksCount(chunks.length)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea>
                <div className="flex flex-col gap-4">
                  {chunks.map((chunk, index) => (
                    <div key={index}>
                      <p className="text-xs font-medium text-muted-foreground">
                        {labels.chunkLabel(index + 1)}
                      </p>
                      <pre className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                        {chunk.content}
                      </pre>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      ) : null}
    </FieldGroup>
  );
}
