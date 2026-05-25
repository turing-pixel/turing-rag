/** Extract the copy-ready reply section from customer_reply workflow markdown output. */

export function extractCustomerReplyBody(markdown: string): string {
  const replyHeader = "## 推荐回复";
  const refsHeader = "## 参考依据";
  const directHeader = "## 推荐回复（可直接复制）";

  let start = markdown.indexOf(directHeader);
  let headerLen = directHeader.length;
  if (start === -1) {
    start = markdown.indexOf(replyHeader);
    headerLen = replyHeader.length;
  }
  if (start === -1) {
    return markdown.trim();
  }

  const bodyStart = start + headerLen;
  let end = markdown.indexOf(refsHeader, bodyStart);
  if (end === -1) {
    end = markdown.length;
  }

  return markdown.slice(bodyStart, end).replace(/^\s*\n+/, "").trim();
}
