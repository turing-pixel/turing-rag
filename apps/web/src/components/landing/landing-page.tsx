import { getTranslations } from "next-intl/server";
import {
  BookOpen,
  FileSearch,
  MessageSquareText,
  Upload,
  Library,
  MessagesSquare,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { HERO_SENTINEL_ID, LandingHeader } from "@/components/landing/landing-header";
import { SilkHeroBackground } from "@/components/landing/silk-hero-background";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Library,
    titleKey: "feature1Title" as const,
    bodyKey: "feature1Body" as const,
  },
  {
    icon: FileSearch,
    titleKey: "feature2Title" as const,
    bodyKey: "feature2Body" as const,
  },
  {
    icon: MessagesSquare,
    titleKey: "feature3Title" as const,
    bodyKey: "feature3Body" as const,
  },
] as const;

const steps = [
  { icon: BookOpen, titleKey: "step1Title" as const, bodyKey: "step1Body" as const },
  { icon: Upload, titleKey: "step2Title" as const, bodyKey: "step2Body" as const },
  {
    icon: MessageSquareText,
    titleKey: "step3Title" as const,
    bodyKey: "step3Body" as const,
  },
] as const;

export async function LandingPage() {
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,color-mix(in_oklch,var(--primary)_6%,transparent),transparent)]" />
      </div>

      <LandingHeader appName={tCommon("appName")} />

      <main>
        <section className="relative w-full min-h-[75vh] overflow-hidden bg-black text-white dark">
          <SilkHeroBackground />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-1 bg-linear-to-b from-black/30 via-transparent to-black/50"
          />
          <div
            id={HERO_SENTINEL_ID}
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 h-px w-full"
          />
          <div className="relative z-10 mx-auto flex min-h-[75vh] max-w-5xl flex-col items-center justify-center px-4 pt-20 pb-20 sm:px-6 sm:pt-24 sm:pb-24">
            <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
              <span className="mb-6 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/80 backdrop-blur-sm">
                {t("heroBadge")}
              </span>
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.15]">
                {t("heroTitle")}
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-white/75 sm:text-lg">
                {t("heroSubtitle")}
              </p>
              <div className="mt-10 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
                <Button size="lg" className="h-11 px-8" asChild>
                  <Link href="/register">{t("getStarted")}</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 border-white/30 bg-white/5 px-8 text-white hover:bg-white/15 hover:text-white"
                  asChild
                >
                  <Link href="/login">{t("signIn")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/20">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {t("featuresTitle")}
            </h2>
            <ul className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {features.map(({ icon: Icon, titleKey, bodyKey }) => (
                <li key={titleKey} className="flex flex-col items-center text-center sm:items-start sm:text-left">
                  <div className="flex size-10 items-center justify-center rounded-lg border border-border/80 bg-background shadow-sm">
                    <Icon
                      className="size-4.5 text-primary"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </div>
                  <h3 className="mt-4 text-base font-medium tracking-tight">
                    {t(titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(bodyKey)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {t("howTitle")}
          </h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {steps.map(({ icon: Icon, titleKey, bodyKey }, index) => (
              <li
                key={titleKey}
                className="relative rounded-xl border border-border/70 bg-card/50 p-6 shadow-sm"
              >
                <span
                  className={cn(
                    "absolute -top-3 left-6 flex size-6 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold tabular-nums text-muted-foreground"
                  )}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <Icon
                  className="size-5 text-primary"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <h3 className="mt-4 text-base font-medium tracking-tight">
                  {t(titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(bodyKey)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border/60">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-col items-center rounded-2xl border border-border/80 bg-muted/30 px-6 py-12 text-center sm:px-12 sm:py-14">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {t("ctaTitle")}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("ctaBody")}
              </p>
              <Button size="lg" className="mt-8 h-11 px-8" asChild>
                <Link href="/register">{t("ctaButton")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-center px-4 sm:px-6">
          <p className="text-xs text-muted-foreground">
            {t("footer", { year: new Date().getFullYear(), appName: tCommon("appName") })}
          </p>
        </div>
      </footer>
    </div>
  );
}
