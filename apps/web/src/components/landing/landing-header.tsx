"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { TopBarActions } from "@/components/top-bar-actions";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const HERO_SENTINEL_ID = "landing-hero-end";
const onDarkActionClass =
  "border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white";

type LandingHeaderProps = {
  appName: string;
};

export function LandingHeader({ appName }: LandingHeaderProps) {
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById(HERO_SENTINEL_ID);
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 transition-[border-color] duration-300",
        pastHero ? "border-b border-border/60" : "border-b border-transparent"
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 backdrop-blur-md transition-colors duration-300",
          pastHero
            ? "bg-linear-to-b from-background/90 via-background/45 to-transparent"
            : "bg-linear-to-b from-black/65 via-black/25 to-transparent"
        )}
      />
      <div
        className={cn(
          "relative mx-auto flex h-16 max-w-5xl items-center justify-between px-4 transition-colors duration-300 sm:px-6",
          pastHero ? "text-foreground" : "text-white"
        )}
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md outline-none ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src="/logo.svg"
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0"
            priority
          />
          <span className="text-sm font-semibold tracking-tight">{appName}</span>
        </Link>
        <TopBarActions actionClassName={pastHero ? undefined : onDarkActionClass} />
      </div>
    </header>
  );
}

export { HERO_SENTINEL_ID };
