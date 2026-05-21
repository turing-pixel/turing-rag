"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Library, Plus, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { KnowledgeBaseIcon } from "@/components/knowledge-base/knowledge-base-icon";
import { ModelSelector } from "@/components/chat/model-selector";
import { api, ApiError } from "@/lib/api";
import {
  getDefaultSelection,
  type LlmModelsResponse,
  type LlmSelection,
} from "@/lib/llm-models";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { NewChatPageSkeleton } from "@/components/skeletons/new-chat-page-skeleton";

interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  icon?: string | null;
  icon_color?: string | null;
}

function NewChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("toasts");
  const tPage = useTranslations("chatPage");
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<string>("");
  const [title, setTitle] = useState("");
  const [kbSearch, setKbSearch] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modelProviders, setModelProviders] = useState<
    LlmModelsResponse["providers"]
  >([]);
  const [selectedModel, setSelectedModel] = useState<LlmSelection | null>(null);

  useEffect(() => {
    void fetchKnowledgeBases();
  }, []);

  const filteredKnowledgeBases = useMemo(() => {
    const query = kbSearch.trim().toLowerCase();
    if (!query) return knowledgeBases;
    return knowledgeBases.filter(
      (kb) =>
        kb.name.toLowerCase().includes(query) ||
        (kb.description ?? "").toLowerCase().includes(query)
    );
  }, [knowledgeBases, kbSearch]);

  const showKbSearch = knowledgeBases.length > 3;

  const fetchKnowledgeBases = async () => {
    try {
      const [data, modelsData] = await Promise.all([
        api.get("/api/knowledge-base"),
        api.get("/api/chat/models") as Promise<LlmModelsResponse>,
      ]);
      setKnowledgeBases(data);
      setModelProviders(modelsData.providers);
      setSelectedModel(getDefaultSelection(modelsData));

      const kbIdParam = searchParams.get("kb_id");
      if (kbIdParam) {
        const kbId = Number(kbIdParam);
        const kb = data.find((item: KnowledgeBase) => item.id === kbId);
        if (kb) {
          setSelectedKB(String(kbId));
          setTitle(
            (prev) => prev || tPage("defaultChatTitle", { name: kb.name })
          );
        }
      } else if (data.length === 1) {
        setSelectedKB(String(data[0].id));
        setTitle(
          (prev) =>
            prev || tPage("defaultChatTitle", { name: data[0].name })
        );
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch knowledge bases:", error);
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedKB) {
      setError(t("chatCreateValidation"));
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const data = await api.post("/api/chat", {
        title,
        knowledge_base_ids: [Number(selectedKB)],
        llm_config_id: selectedModel?.configId ?? undefined,
        llm_provider: selectedModel?.configId
          ? undefined
          : selectedModel?.provider,
        llm_model: selectedModel?.configId ? undefined : selectedModel?.model,
      });

      router.push(`/dashboard/chat/${data.id}`);
    } catch (error) {
      console.error("Failed to create chat:", error);
      if (error instanceof ApiError) {
        setError(error.message);
        toast.error(error.message);
      } else {
        setError(t("chatCreateError"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoading && knowledgeBases.length === 0) {
    return (
      <DashboardLayout>
        <DashboardPageContainer>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Library />
              </EmptyMedia>
              <EmptyTitle>{tPage("noKbTitle")}</EmptyTitle>
              <EmptyDescription>{tPage("noKbBody")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/dashboard/knowledge">
                  <Plus />
                  {tPage("goCreateKb")}
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        </DashboardPageContainer>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardPageContainer className="space-y-6">
        <header className="flex items-start gap-3">
          <Button variant="outline" size="icon-sm" asChild>
            <Link href="/dashboard/chat" aria-label={tPage("backToList")}>
              <ArrowLeft />
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {tPage("newTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tPage("newSubtitle")}
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FieldSet>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">{tPage("chatTitleLabel")}</FieldLabel>
                {isLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    type="text"
                    required
                    placeholder={tPage("chatTitlePlaceholder")}
                  />
                )}
              </Field>

              <Field>
                <FieldLabel>{tPage("modelLabel")}</FieldLabel>
                <FieldDescription>{tPage("modelDescription")}</FieldDescription>
                {isLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <ModelSelector
                    providers={modelProviders}
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                    disabled={isSubmitting}
                    manageHref="/dashboard/llm-configs"
                  />
                )}
              </Field>

              <FieldSeparator />

              <Field>
                <FieldLegend variant="label">
                  {tPage("knowledgeBaseLabel")}
                </FieldLegend>
                <FieldDescription>{tPage("singleSelectHint")}</FieldDescription>

                {showKbSearch && !isLoading ? (
                  <InputGroup>
                    <InputGroupAddon>
                      <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="search"
                      placeholder={tPage("kbSearchPlaceholder")}
                      value={kbSearch}
                      onChange={(e) => setKbSearch(e.target.value)}
                    />
                  </InputGroup>
                ) : null}

                {isLoading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 w-full rounded-md" />
                    ))}
                  </div>
                ) : filteredKnowledgeBases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {tPage("kbSearchNoResults")}
                  </p>
                ) : (
                  <RadioGroup
                    value={selectedKB}
                    onValueChange={setSelectedKB}
                  >
                    {filteredKnowledgeBases.map((kb) => (
                      <FieldLabel key={kb.id} htmlFor={`kb-${kb.id}`}>
                        <Field orientation="horizontal">
                          <RadioGroupItem
                            value={String(kb.id)}
                            id={`kb-${kb.id}`}
                          />
                          <KnowledgeBaseIcon
                            icon={kb.icon}
                            iconColor={kb.icon_color}
                          />
                          <FieldContent>
                            <FieldTitle>{kb.name}</FieldTitle>
                            <FieldDescription>
                              {kb.description || tPage("noDescription")}
                            </FieldDescription>
                          </FieldContent>
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                )}
              </Field>

              {error ? <FieldError>{error}</FieldError> : null}
            </FieldGroup>
          </FieldSet>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              {tPage("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading || isSubmitting || !selectedKB || !selectedModel
              }
            >
              {isSubmitting ? tPage("creating") : tPage("startChat")}
            </Button>
          </div>
        </form>
      </DashboardPageContainer>
    </DashboardLayout>
  );
}

export default function NewChatPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <DashboardPageContainer>
            <NewChatPageSkeleton />
          </DashboardPageContainer>
        </DashboardLayout>
      }
    >
      <NewChatPageContent />
    </Suspense>
  );
}
