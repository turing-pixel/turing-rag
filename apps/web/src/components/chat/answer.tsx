import React, {
  FC,
  useMemo,
  useEffect,
  useState,
  ClassAttributes,
} from "react";
import { AnchorHTMLAttributes } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { api } from "@/lib/api";
import { kbRefFromMetadata } from "@/lib/kb-ref";
import {
  CitationInvalidReference,
  CitationReference,
  type Citation,
  type CitationInfo,
} from "@/components/chat/citation-reference";
import { normalizeCitationMarkdown } from "@/lib/chat-message";
const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const Answer: FC<{
  markdown: string;
  citations?: Citation[];
}> = ({ markdown, citations = [] }) => {
  const [citationInfoMap, setCitationInfoMap] = useState<
    Record<string, CitationInfo>
  >({});
  const [citationFailedKeys, setCitationFailedKeys] = useState<Set<string>>(
    () => new Set()
  );

  const debouncedCitations = useDebouncedValue(citations, 300);

  const processedMarkdown = useMemo(() => {
    return normalizeCitationMarkdown(markdown)
      .replace(/<think>/g, "## Thinking\n```think")
      .replace(/<\/think>/g, "```");
  }, [markdown]);

  useEffect(() => {
    const currentKeys = new Set(
      debouncedCitations
        .map((citation) => {
          const kbRef = kbRefFromMetadata(citation.metadata);
          const documentId = citation.metadata.document_id;
          if (kbRef == null || documentId == null) return null;
          return `${kbRef}-${documentId}`;
        })
        .filter((key): key is string => key != null)
    );

    setCitationFailedKeys((prev) => {
      const next = new Set<string>();
      for (const key of prev) {
        if (currentKeys.has(key)) next.add(key);
      }
      return next;
    });

    const fetchCitationInfo = async () => {
      const infoMap: Record<string, CitationInfo> = {};
      const failedKeys = new Set<string>();

      for (const citation of debouncedCitations) {
        const kbRef = kbRefFromMetadata(citation.metadata);
        const documentId = citation.metadata.document_id;
        if (kbRef == null || documentId == null) continue;

        const key = `${kbRef}-${documentId}`;
        if (infoMap[key] || failedKeys.has(key)) continue;

        try {
          const [kb, doc] = await Promise.all([
            api.get(`/api/knowledge-base/${kbRef}`),
            api.get(`/api/knowledge-base/${kbRef}/documents/${documentId}`),
          ]);

          infoMap[key] = {
            knowledge_base: {
              name: kb.name,
            },
            document: {
              file_name: doc.file_name,
              knowledge_base: {
                name: kb.name,
              },
            },
          };
        } catch (error) {
          console.error("Failed to fetch citation info:", error);
          failedKeys.add(key);
        }
      }

      setCitationInfoMap((prev) => ({ ...prev, ...infoMap }));
      if (failedKeys.size > 0) {
        setCitationFailedKeys((prev) => new Set([...prev, ...failedKeys]));
      }
    };

    if (debouncedCitations.length > 0) {
      void fetchCitationInfo();
    }
  }, [debouncedCitations]);

  const CitationLink = useMemo(() => {
    const CitationLinkComponent = (
      props: ClassAttributes<HTMLAnchorElement> &
        AnchorHTMLAttributes<HTMLAnchorElement>
    ) => {
      const citationId = props.href?.match(/^(\d+)$/)?.[1];
      const index = citationId ? parseInt(citationId, 10) : NaN;
      const citation = Number.isFinite(index)
        ? debouncedCitations[index - 1]
        : null;

      if (!citation) {
        return Number.isFinite(index) ? (
          <CitationInvalidReference index={index} />
        ) : (
          <span className="text-muted-foreground">[{props.href}]</span>
        );
      }

      const kbRef = kbRefFromMetadata(citation.metadata);
      const citationKey =
        kbRef != null && citation.metadata.document_id != null
          ? `${kbRef}-${citation.metadata.document_id}`
          : "";
      const citationInfo = citationInfoMap[citationKey];
      const citationLoadFailed = citationFailedKeys.has(citationKey);

      return (
        <CitationReference
          index={index}
          citation={citation}
          citationInfo={citationInfo}
          citationLoadFailed={citationLoadFailed}
          anchorProps={props}
        />
      );
    };
    CitationLinkComponent.displayName = "CitationLink";
    return CitationLinkComponent;
  }, [debouncedCitations, citationInfoMap, citationFailedKeys]);

  if (!markdown) {
    return null;
  }

  return (
    <div className="chat-assistant-markdown min-w-0 max-w-full">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: CitationLink,
          table: ({ children, ...props }) => (
            <div className="chat-markdown-table-wrap">
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {processedMarkdown}
      </Markdown>
    </div>
  );
};
