import { WORKFLOW_EXPORT_HTML_STYLES } from "@/lib/workflow-export-styles";

export function looksLikeMarkdown(text: string): boolean {
  if (!text.trim()) return false;
  return /(^|\n)\s{0,3}#{1,6}\s|(^|\n)\s*[-*+]\s|(^|\n)\s*\d+\.\s|\*\*|__|`{1,3}|^\s*>\s/m.test(
    text
  );
}

export function shouldRenderMarkdown(content: string, outputFormat?: string): boolean {
  if (outputFormat === "markdown") return true;
  return looksLikeMarkdown(content);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildExportHtmlDocument(title: string, bodyHtml: string) {
  const safeTitle = title.replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>${WORKFLOW_EXPORT_HTML_STYLES}</style>
</head>
<body>
  <div class="chat-assistant-markdown">${bodyHtml}</div>
</body>
</html>`;
}

export function exportWorkflowHtml(htmlDocument: string, filename: string) {
  const blob = new Blob([htmlDocument], { type: "text/html;charset=utf-8" });
  downloadBlob(`${filename}.html`, blob);
}

export function exportWorkflowPdf(htmlDocument: string) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    throw new Error("popup_blocked");
  }
  win.document.write(htmlDocument);
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    win.print();
  }, 300);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToHtmlFallback(markdown: string): string {
  const lines = markdown.split("\n");
  const parts: string[] = [];
  let inPre = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (!inPre) {
        inPre = true;
        parts.push("<pre><code>");
      } else {
        inPre = false;
        parts.push("</code></pre>");
      }
      continue;
    }
    if (inPre) {
      parts.push(`${escapeHtml(line)}\n`);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const tag = `h${Math.min(level, 6)}`;
      parts.push(`<${tag}>${escapeHtml(line.replace(/^#+\s*/, ""))}</${tag}>`);
      continue;
    }
    if (line.trim() === "") {
      parts.push("<br />");
      continue;
    }
    parts.push(`<p>${escapeHtml(line)}</p>`);
  }
  if (inPre) {
    parts.push("</code></pre>");
  }
  return parts.join("\n");
}

export async function buildWorkflowExportHtml(
  title: string,
  markdown: string,
  previewHtml?: string
) {
  const body = previewHtml?.trim() ? previewHtml : markdownToHtmlFallback(markdown);
  return buildExportHtmlDocument(title, body);
}

export async function exportWorkflowDocx(markdown: string, filename: string) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");

  const paragraphs = markdown.split("\n").map((line) => {
    const trimmed = line.trimEnd();
    if (!trimmed) {
      return new Paragraph({ children: [new TextRun("")] });
    }
    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(h1[1])],
      });
    }
    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun(h2[1])],
      });
    }
    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun(h3[1])],
      });
    }
    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      return new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun(bullet[1])],
      });
    }
    return new Paragraph({ children: [new TextRun(trimmed)] });
  });

  const doc = new Document({
    sections: [{ children: paragraphs }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(`${filename}.docx`, blob);
}
