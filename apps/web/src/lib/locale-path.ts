import { routing } from "@/i18n/routing";

/**
 * Login href respecting locale prefix (for non-React contexts e.g. api fetch 401).
 */
export function getLoginHrefFromPathname(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return `/${locale}/login`;
    }
  }
  return "/login";
}
