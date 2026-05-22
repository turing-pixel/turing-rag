"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { stripLocaleFromPathname } from "@/lib/i18n-path";
import { cn } from "@/lib/utils";

const SEGMENT_KEYS = [
  "dashboard",
  "knowledge",
  "chat",
  "new",
  "upload",
  "api-keys",
  "llm-configs",
  "embedding-configs",
  "test-retrieval",
  "rag",
] as const;

type SegmentKey = (typeof SEGMENT_KEYS)[number];

function isSegmentKey(s: string): s is SegmentKey {
  return (SEGMENT_KEYS as readonly string[]).includes(s);
}

const DASHBOARD_SECTION_KEYS = new Set<SegmentKey>([
  "knowledge",
  "chat",
  "rag",
  "api-keys",
  "llm-configs",
  "embedding-configs",
  "test-retrieval",
]);

/** Ensure breadcrumb hrefs stay under /dashboard (avoids /en/chat 404s). */
function normalizeDashboardSegments(segments: string[]): string[] {
  if (segments.length === 0) return segments;
  if (segments[0] === "dashboard") return segments;
  if (DASHBOARD_SECTION_KEYS.has(segments[0] as SegmentKey)) {
    return ["dashboard", ...segments];
  }
  return segments;
}

function segmentLabel(
  segment: string,
  tSeg: ReturnType<typeof useTranslations<"dashboard.breadcrumb.segments">>
): string {
  if (/^\d+$/.test(segment)) return `#${segment}`;
  if (isSegmentKey(segment)) return tSeg(segment);
  return segment;
}

type DashboardBreadcrumbProps = {
  className?: string;
};

export default function DashboardBreadcrumb({
  className,
}: DashboardBreadcrumbProps) {
  const pathname = stripLocaleFromPathname(usePathname() ?? "");
  const t = useTranslations("dashboard.breadcrumb");
  const tSeg = useTranslations("dashboard.breadcrumb.segments");
  const raw = normalizeDashboardSegments(pathname.split("/").filter(Boolean));

  if (raw.length === 0) return null;

  const crumbs = raw.map((seg, index) => ({
    seg,
    href: `/${raw.slice(0, index + 1).join("/")}`,
    isLast: index === raw.length - 1,
  }));

  return (
    <Breadcrumb className={cn(className)} aria-label={t("aria")}>
      <BreadcrumbList>
        {crumbs.map((c, i) => (
          <Fragment key={c.href}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {c.isLast ? (
                <BreadcrumbPage>{segmentLabel(c.seg, tSeg)}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={c.href}>{segmentLabel(c.seg, tSeg)}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
