/**
 * Parses Vercel AI Data Stream v1 lines emitted by the chat API.
 * @see apps/api/app/services/chat_service.py
 */

export class StreamIdleTimeoutError extends Error {
  constructor(message = "Stream idle timeout") {
    super(message);
    this.name = "StreamIdleTimeoutError";
  }
}

export class StreamEmptyResponseError extends Error {
  constructor(message = "Stream ended without content") {
    super(message);
    this.name = "StreamEmptyResponseError";
  }
}

export function parseDataStreamLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex === -1) return null;

  const code = trimmed.slice(0, colonIndex);
  const payload = trimmed.slice(colonIndex + 1);

  if (code === "0") {
    try {
      return JSON.parse(payload) as string;
    } catch {
      return null;
    }
  }

  if (code === "3") {
    try {
      const data = JSON.parse(payload) as { text?: string; message?: string };
      throw new Error(data.text ?? data.message ?? "Stream error");
    } catch (err) {
      if (err instanceof Error && err.message !== "Stream error") throw err;
      throw new Error(payload || "Stream error");
    }
  }

  return null;
}

export interface ReadDataStreamOptions {
  /** Abort read when no bytes arrive for this long (ms). Default 120s. Set 0 to disable. */
  idleTimeoutMs?: number;
  /** When true (default), throw if the stream closes without any text chunk. */
  requireText?: boolean;
}

const DEFAULT_IDLE_TIMEOUT_MS = 120_000;

function readWithIdleTimeout<T>(
  promise: Promise<T>,
  idleTimeoutMs: number,
  onTimeout: () => void
): Promise<T> {
  if (idleTimeoutMs <= 0) {
    return promise;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new StreamIdleTimeoutError());
    }, idleTimeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function readDataStream(
  body: ReadableStream<Uint8Array>,
  onText: (chunk: string) => void,
  options: ReadDataStreamOptions = {}
): Promise<{ receivedText: boolean }> {
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const requireText = options.requireText !== false;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedText = false;

  try {
    while (true) {
      const { done, value } = await readWithIdleTimeout(
        reader.read(),
        idleTimeoutMs,
        () => {
          void reader.cancel();
        }
      );
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const text = parseDataStreamLine(line);
        if (text) {
          receivedText = true;
          onText(text);
        }
      }
    }

    if (buffer.trim()) {
      const text = parseDataStreamLine(buffer);
      if (text) {
        receivedText = true;
        onText(text);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (requireText && !receivedText) {
    throw new StreamEmptyResponseError();
  }

  return { receivedText };
}
