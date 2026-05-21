import { routing } from "@/i18n/routing";

/**
 * Strip any configured locale prefix from a pathname.
 * Guards against double prefixes like `/zh/zh/login` when switching languages.
 */
export function stripLocaleFromPathname(pathname: string): string {
  let result = pathname;
  let previous = "";

  while (result !== previous) {
    previous = result;
    for (const locale of routing.locales) {
      const prefix = `/${locale}`;
      if (result === prefix) {
        result = "/";
      } else if (result.startsWith(`${prefix}/`)) {
        result = result.slice(prefix.length) || "/";
      }
    }
  }

  return result;
}

/** True when pathname has repeated locale segments (e.g. `/zh/zh/login`). */
export function hasDuplicateLocalePrefix(pathname: string): boolean {
  for (const locale of routing.locales) {
    const nested = `/${locale}/${locale}`;
    if (pathname === nested || pathname.startsWith(`${nested}/`)) {
      return true;
    }
  }
  return false;
}
