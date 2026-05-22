/** Maps API progress_message strings (English) to processingProgress i18n keys. */

const EXACT_MESSAGE_KEYS: Record<string, string> = {
  "Resolving file": "resolvingFile",
  "Reading document": "readingDocument",
  "Document loaded": "documentLoaded",
  "Splitting into chunks": "splittingIntoChunks",
  "Connecting to vector index": "connectingToVectorIndex",
  "Clearing old embeddings": "clearingOldEmbeddings",
  "Saving file": "savingFile",
  "Saving chunks": "savingChunks",
  "Embedding": "embedding",
  "Processing failed": "processingFailed",
  "Vector index connection failed": "vectorIndexConnectionFailed",
  "Embedding failed": "embeddingFailed",
};

const SAVING_CHUNKS_PROGRESS_RE = /^Saving chunks (\d+)\/(\d+)$/;
const EMBEDDING_PROGRESS_RE = /^Embedding (\d+)\/(\d+)$/;

export type ProgressMessageTranslator = (
  key: string,
  values?: Record<string, string | number>
) => string;

export function formatProgressMessage(
  message: string | null | undefined,
  t: ProgressMessageTranslator
): string {
  const raw = message?.trim();
  if (!raw) return "";

  const exactKey = EXACT_MESSAGE_KEYS[raw];
  if (exactKey) return t(exactKey);

  const savingMatch = raw.match(SAVING_CHUNKS_PROGRESS_RE);
  if (savingMatch) {
    return t("savingChunksProgress", {
      current: savingMatch[1],
      total: savingMatch[2],
    });
  }

  const embeddingMatch = raw.match(EMBEDDING_PROGRESS_RE);
  if (embeddingMatch) {
    return t("embeddingProgress", {
      current: embeddingMatch[1],
      total: embeddingMatch[2],
    });
  }

  return raw;
}
