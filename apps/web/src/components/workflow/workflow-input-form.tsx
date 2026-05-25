"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowDocumentFileField } from "@/components/workflow/workflow-document-file-field";

interface WorkflowInputFormProps {
  schema: Record<string, unknown>;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}

export function WorkflowInputForm({
  schema,
  value,
  onChange,
}: WorkflowInputFormProps) {
  const properties =
    (schema.properties as Record<string, Record<string, unknown>>) || {};
  const required = (schema.required as string[]) || [];

  const setField = (key: string, fieldValue: unknown) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <div className="space-y-4">
      {Object.entries(properties).map(([key, field]) => {
        const title = (field.title as string) || key;
        const isRequired = required.includes(key);
        const fieldType = field.type as string;
        const enumValues = field.enum as string[] | undefined;
        const widget = field["ui:widget"] as string | undefined;

        if (widget === "file") {
          return (
            <WorkflowDocumentFileField
              key={key}
              label={title}
              required={isRequired}
              value={String(value[key] ?? "")}
              fileName={(value[`${key}_file_name`] as string) || null}
              onChange={(text, meta) => {
                onChange({
                  ...value,
                  [key]: text,
                  [`${key}_file_name`]: meta?.fileName ?? null,
                });
              }}
            />
          );
        }

        if (enumValues?.length) {
          return (
            <div key={key} className="space-y-2">
              <Label>
                {title}
                {isRequired ? " *" : ""}
              </Label>
              <Select
                value={String(value[key] ?? field.default ?? enumValues[0])}
                onValueChange={(v) => setField(key, v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enumValues.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (fieldType === "integer" || fieldType === "number") {
          return (
            <div key={key} className="space-y-2">
              <Label>
                {title}
                {isRequired ? " *" : ""}
              </Label>
              <Input
                type="number"
                value={String(value[key] ?? field.default ?? "")}
                onChange={(e) => setField(key, Number(e.target.value))}
              />
            </div>
          );
        }

        if (
          widget === "textarea" ||
          key.includes("text") ||
          key.includes("context") ||
          key.includes("question")
        ) {
          return (
            <div key={key} className="space-y-2">
              <Label>
                {title}
                {isRequired ? " *" : ""}
              </Label>
              <Textarea
                rows={8}
                value={String(value[key] ?? "")}
                onChange={(e) => setField(key, e.target.value)}
              />
            </div>
          );
        }

        return (
          <div key={key} className="space-y-2">
            <Label>
              {title}
              {isRequired ? " *" : ""}
            </Label>
            <Input
              value={String(value[key] ?? "")}
              onChange={(e) => setField(key, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
