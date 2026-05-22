/**
 * API datetimes are stored as UTC but often serialized without a timezone suffix.
 * Treat naive ISO strings as UTC so relative and absolute displays match server time.
 */
export function parseApiDateTime(iso: string): Date {
  const trimmed = iso.trim();
  if (!trimmed) {
    return new Date(Number.NaN);
  }
  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  return new Date(`${trimmed}Z`);
}

export function formatApiDateTime(date: Date, locale: string): string {
  const tag = locale === "zh" ? "zh-CN" : "en-US";
  return date.toLocaleString(tag, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
