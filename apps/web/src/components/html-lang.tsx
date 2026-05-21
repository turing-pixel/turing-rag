"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

/** Keeps `<html lang>` in sync when the user switches locale on the client. */
export function HtmlLang() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
