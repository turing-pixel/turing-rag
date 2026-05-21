"use client";

import { Suspense } from "react";
import { Check, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LOCALE_LABEL_KEYS = {
  en: "english",
  zh: "chinese",
} as const satisfies Record<(typeof routing.locales)[number], "english" | "chinese">;

function LocaleSwitcherFallback({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(className)}
      disabled
      aria-hidden
    >
      <Languages />
    </Button>
  );
}

function LocaleSwitcherMenu({ className }: { className?: string }) {
  const locale = useLocale();
  const href = useLocalizedHref();
  const t = useTranslations("common");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(className)}
          aria-label={t("language")}
        >
          <Languages />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((value) => (
          <DropdownMenuItem key={value} asChild>
            <Link
              href={href}
              locale={value}
              className="flex w-full cursor-pointer items-center gap-2"
            >
              {t(LOCALE_LABEL_KEYS[value])}
              {locale === value ? (
                <Check className="ml-auto size-4 opacity-70" />
              ) : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LocaleSwitcher({ className }: { className?: string }) {
  return (
    <Suspense fallback={<LocaleSwitcherFallback className={className} />}>
      <LocaleSwitcherMenu className={className} />
    </Suspense>
  );
}
