/** Resolve knowledge base API path segment from citation/stream metadata. */
export function kbRefFromMetadata(
  metadata: Record<string, unknown> | undefined
): string | null {
  if (!metadata) return null;
  const uuid = metadata.kb_uuid;
  if (typeof uuid === "string" && uuid.trim() !== "") {
    return uuid.trim();
  }
  return null;
}
