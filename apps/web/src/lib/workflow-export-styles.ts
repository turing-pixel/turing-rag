/** Standalone HTML export styles aligned with `.chat-assistant-markdown`. */
export const WORKFLOW_EXPORT_HTML_STYLES = `
body { margin: 1.5rem; font-family: system-ui, sans-serif; color: #111; line-height: 1.65; }
.chat-assistant-markdown { max-width: 48rem; }
.chat-assistant-markdown h1, .chat-assistant-markdown h2, .chat-assistant-markdown h3 {
  font-weight: 600; line-height: 1.3; margin: 0.75em 0 0.35em;
}
.chat-assistant-markdown h1 { font-size: 1.25rem; }
.chat-assistant-markdown h2 { font-size: 1.125rem; }
.chat-assistant-markdown h3 { font-size: 1rem; }
.chat-assistant-markdown p { margin: 0.35em 0; }
.chat-assistant-markdown ul, .chat-assistant-markdown ol { margin: 0.35em 0; padding-left: 1.25em; }
.chat-assistant-markdown blockquote {
  margin: 0.4em 0; padding-left: 0.85em; border-left: 2px solid #ddd; color: #555;
}
.chat-assistant-markdown pre {
  margin: 0.4em 0; padding: 0.625rem 0.75rem; overflow-x: auto;
  border-radius: 0.5rem; border: 1px solid #e5e5e5; background: #f5f5f5; font-size: 0.8125rem;
}
.chat-assistant-markdown :not(pre) > code {
  font-size: 0.875em; padding: 0.12em 0.35em; border-radius: 0.25rem;
  background: #f5f5f5; border: 1px solid #e5e5e5;
}
.chat-assistant-markdown table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.chat-assistant-markdown th, .chat-assistant-markdown td {
  border: 1px solid #e5e5e5; padding: 0.45em 0.65em; text-align: left;
}
.chat-assistant-markdown th { background: #f5f5f5; font-weight: 600; }
@media print { body { margin: 1rem; } }
`;
