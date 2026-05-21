"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { stripLocaleFromPathname } from "@/lib/i18n-path";

/**
 * Locale-free pathname (+ query) for locale-aware Link navigation.
 */
export function useLocalizedHref() {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  return useMemo(() => {
    const normalizedPathname = stripLocaleFromPathname(pathname);
    const query = Object.fromEntries(searchParams.entries());

    return Object.keys(query).length > 0
      ? { pathname: normalizedPathname, query }
      : normalizedPathname;
  }, [pathname, searchParams]);
}
