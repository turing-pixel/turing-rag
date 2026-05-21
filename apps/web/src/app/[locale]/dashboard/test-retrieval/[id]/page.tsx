"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { ArrowRight, ChevronDown, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TestRetrievalPageSkeleton } from "@/components/skeletons/test-retrieval-page-skeleton";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
}

interface RetrievalResult {
  score: number;
  content: string;
  metadata: { source?: string };
}

const TOP_K_OPTIONS = ["1", "3", "5", "10"] as const;

function RetrievalResultItem({
  result,
  t,
}: {
  result: RetrievalResult;
  t: ReturnType<typeof useTranslations<"testRetrieval">>;
}) {
  return (
    <Collapsible defaultOpen={false}>
      <Item variant="outline">
        <ItemContent>
          <CollapsibleTrigger
            aria-label={t("resultToggleAria")}
            className="group w-full"
          >
            <ItemHeader>
              <Badge variant="secondary">
                {t("scoreLabel", {
                  score: (result.score * 100).toFixed(2),
                })}
              </Badge>
              {result.metadata?.source ? (
                <ItemDescription>
                  {t("sourceLabel", {
                    source: String(result.metadata.source),
                  })}
                </ItemDescription>
              ) : null}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </ItemHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {result.content}
            </p>
          </CollapsibleContent>
        </ItemContent>
      </Item>
    </Collapsible>
  );
}

export default function TestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tToast = useTranslations("toasts");
  const t = useTranslations("testRetrieval");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RetrievalResult[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(
    null
  );
  const [isKbLoading, setIsKbLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [topK, setTopK] = useState("3");

  useEffect(() => {
    const fetchKnowledgeBase = async () => {
      setIsKbLoading(true);
      try {
        const data = await api.get(`/api/knowledge-base/${id}`);
        setKnowledgeBase(data);
      } catch (error) {
        console.error("Failed to fetch knowledge base:", error);
        if (error instanceof ApiError) {
          toast.error(error.message);
        }
      } finally {
        setIsKbLoading(false);
      }
    };

    void fetchKnowledgeBase();
  }, [id]);

  const handleTest = async () => {
    if (!query) {
      toast.error(tToast("testRetrievalMissing"));
      return;
    }

    setLoading(true);
    try {
      const data = await api.post("/api/knowledge-base/test-retrieval", {
        query,
        kb_id: parseInt(id, 10),
        top_k: parseInt(topK, 10),
      });

      setResults(data.results);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : tToast("testRetrievalError")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardPageContainer className="space-y-8" aria-busy={isKbLoading}>
        {isKbLoading ? (
          <TestRetrievalPageSkeleton />
        ) : (
          <>
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {knowledgeBase?.name ?? ""}
            {knowledgeBase?.description
              ? ` \u00b7 ${knowledgeBase.description}`
              : null}
          </p>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </header>

        <section className="space-y-4">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("queryPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  void handleTest();
                }
              }}
              disabled={loading}
            />
          </InputGroup>

          <div className="flex flex-wrap items-end gap-3">
            <Field>
              <FieldLabel>{t("topKPlaceholder")}</FieldLabel>
              <Select value={topK} onValueChange={setTopK} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder={t("topKPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {TOP_K_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {t("topKOption", { n })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button onClick={() => void handleTest()} disabled={loading}>
              {loading ? (
                <>
                  <Spinner />
                  {t("searching")}
                </>
              ) : (
                <>
                  {t("search")}
                  <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </section>

        {results.length > 0 ? (
          <>
            <Separator />
            <section className="space-y-4">
              <h2 className="text-lg font-medium">{t("resultsTitle")}</h2>
              <ItemGroup>
                {results.map((result, index) => (
                  <RetrievalResultItem
                    key={`${index}-${result.metadata?.source ?? index}`}
                    result={result}
                    t={t}
                  />
                ))}
              </ItemGroup>
            </section>
          </>
        ) : null}
          </>
        )}
      </DashboardPageContainer>
    </DashboardLayout>
  );
}
