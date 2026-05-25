"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface WorkflowMarkdownOutputProps {
  content: string;
  className?: string;
}

export function WorkflowMarkdownOutput({
  content,
  className = "chat-assistant-markdown min-w-0 max-w-full",
}: WorkflowMarkdownOutputProps) {
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          table: ({ children, ...props }) => (
            <div className="chat-markdown-table-wrap">
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
