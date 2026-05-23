/** Crockford Base32 ULID (26 chars), matching backend uuid column. */
export const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

export function isUlid(value: string): boolean {
  return ULID_RE.test(value.trim());
}
