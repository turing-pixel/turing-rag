import {
  defaultStyles,
  type DefaultExtensionType,
  type FileIconProps,
} from "react-file-icon";

const KNOWN_EXTENSIONS = new Set<string>(Object.keys(defaultStyles));

/** Neutral document style when extension is unknown (no pale “block” fill). */
const FALLBACK_STYLE: Partial<FileIconProps> = {
  type: "document",
  color: "#94A3B8",
  foldColor: "#64748B",
  glyphColor: "#F8FAFC",
  labelColor: "#64748B",
};

function extensionFromFileName(fileName: string): string {
  const segment = fileName.split(".").pop();
  return segment ? segment.toLowerCase() : "";
}

function extensionFromContentType(contentType: string): string | null {
  const ct = contentType.toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (
    ct.includes("wordprocessingml") ||
    ct.includes("msword") ||
    ct.includes("application/doc")
  ) {
    return ct.includes("openxmlformats") ? "docx" : "doc";
  }
  if (ct.includes("markdown")) return "md";
  if (ct.startsWith("text/plain")) return "txt";
  if (ct.includes("spreadsheet") || ct.includes("excel")) return "xlsx";
  if (ct.includes("presentation") || ct.includes("powerpoint")) return "pptx";
  return null;
}

function normalizeExtension(ext: string): string {
  if (ext === "markdown") return "md";
  return ext;
}

function isKnownExtension(ext: string): ext is DefaultExtensionType {
  return KNOWN_EXTENSIONS.has(ext);
}

/**
 * Props for `react-file-icon` from file name and optional MIME type.
 * Prefers filename extension; falls back to content-type mapping.
 */
export function getDocumentFileIconProps(
  fileName: string,
  contentType?: string
): FileIconProps {
  let ext = normalizeExtension(extensionFromFileName(fileName));

  if ((!ext || !isKnownExtension(ext)) && contentType) {
    const fromMime = extensionFromContentType(contentType);
    if (fromMime) ext = normalizeExtension(fromMime);
  }

  if (isKnownExtension(ext)) {
    return {
      extension: ext,
      ...defaultStyles[ext],
    };
  }

  return {
    extension: ext || undefined,
    ...FALLBACK_STYLE,
  };
}
