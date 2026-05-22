import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import {
  hasDuplicateLocalePrefix,
  stripLocaleFromPathname,
} from "./lib/i18n-path";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Only fix malformed URLs like `/zh/zh/login`. Do not strip valid `/zh/login`,
  // or next-intl cookie negotiation will loop with this redirect.
  if (hasDuplicateLocalePrefix(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = stripLocaleFromPathname(pathname);
    url.search = search;
    return NextResponse.redirect(url);
  }

  const normalized = stripLocaleFromPathname(pathname);

  const needsDashboardPrefix =
    normalized === "/chat" ||
    normalized.startsWith("/chat/") ||
    normalized === "/knowledge" ||
    normalized.startsWith("/knowledge/");

  if (needsDashboardPrefix) {
    const locale =
      routing.locales.find(
        (value) =>
          pathname === `/${value}` || pathname.startsWith(`/${value}/`)
      ) ?? routing.defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard${normalized}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|health|.*\\..*).*)"],
};
