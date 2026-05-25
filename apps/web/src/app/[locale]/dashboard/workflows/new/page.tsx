"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";

import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import {
  createWorkflow,
  listWorkflowTemplates,
  type WorkflowTemplate,
} from "@/lib/workflow";

interface KnowledgeBaseOption {
  uuid: string;
  name: string;
}

export default function NewWorkflowPage() {
  const t = useTranslations("dashboard.workflows");
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [kbs, setKbs] = useState<KnowledgeBaseOption[]>([]);
  const [templateKey, setTemplateKey] = useState("");
  const [name, setName] = useState("");
  const [selectedKb, setSelectedKb] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [llmConfigs, setLlmConfigs] = useState<
    Array<{ id: number; name: string; provider: string; model: string }>
  >([]);
  const [llmConfigId, setLlmConfigId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [tpls, kbList, llmList] = await Promise.all([
          listWorkflowTemplates(),
          api.get("/api/knowledge-base") as Promise<KnowledgeBaseOption[]>,
          api.get("/api/llm-configs") as Promise<
            Array<{ id: number; name: string; provider: string; model: string }>
          >,
        ]);
        setTemplates(tpls);
        setKbs(kbList);
        setLlmConfigs(llmList);
        if (tpls[0]) {
          setTemplateKey(tpls[0].key);
          setName(tpls[0].name);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleKb = (uuid: string) => {
    setSelectedKb((prev) =>
      prev.includes(uuid) ? prev.filter((id) => id !== uuid) : [...prev, uuid]
    );
  };

  const handleCreate = useCallback(async () => {
    if (!templateKey || !name.trim()) return;
    setSaving(true);
    try {
      const wf = await createWorkflow({
        template_key: templateKey,
        name: name.trim(),
        config: { knowledge_base_uuids: selectedKb },
        llm_config_id: llmConfigId ? Number(llmConfigId) : undefined,
      });
      toast.success("Created");
      router.push(`/dashboard/workflows/${wf.uuid}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }, [name, router, selectedKb, templateKey]);

  if (loading) {
    return (
      <DashboardPageContainer>
        <div className="flex justify-center py-16">
          <Spinner className="size-8" />
        </div>
      </DashboardPageContainer>
    );
  }

  return (
    <DashboardPageContainer className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">{t("new")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("selectTemplate")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => {
                  setTemplateKey(tpl.key);
                  if (!name || templates.some((x) => x.name === name)) {
                    setName(tpl.name);
                  }
                }}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  templateKey === tpl.key
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="font-medium">{tpl.name}</div>
                <div className="mt-1 text-muted-foreground">{tpl.description}</div>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label>{t("name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>LLM</Label>
            <Select value={llmConfigId || "default"} onValueChange={setLlmConfigId}>
              <SelectTrigger>
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Use account default</SelectItem>
                {llmConfigs.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("knowledgeBases")}</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {kbs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No knowledge bases</p>
              ) : (
                kbs.map((kb) => (
                  <label
                    key={kb.uuid}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedKb.includes(kb.uuid)}
                      onCheckedChange={() => toggleKb(kb.uuid)}
                    />
                    {kb.name}
                  </label>
                ))
              )}
            </div>
          </div>

          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? <Spinner className="size-4" /> : t("save")}
          </Button>
        </CardContent>
      </Card>
    </DashboardPageContainer>
  );
}
