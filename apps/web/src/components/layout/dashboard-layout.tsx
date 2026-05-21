"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Book,
  LayoutDashboard,
  LogOut,
  Menu,
  Key,
  MessageSquare,
  Bot,
  GitBranch,
} from "lucide-react";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { TopBarActions } from "@/components/top-bar-actions";
import { cn } from "@/lib/utils";

/** Shared top bar height for sidebar brand row and main content header (lg+). */
const DASHBOARD_TOPBAR_HEIGHT_CLASS = "h-14 shrink-0";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("dashboard.nav");
  const tCommon = useTranslations("common");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const navigation = [
    {
      nameKey: "overview" as const,
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      nameKey: "knowledgeBase" as const,
      href: "/dashboard/knowledge",
      icon: Book,
    },
    { nameKey: "chat" as const, href: "/dashboard/chat", icon: MessageSquare },
    { nameKey: "rag" as const, href: "/dashboard/rag", icon: GitBranch },
    {
      nameKey: "llmConfigs" as const,
      href: "/dashboard/llm-configs",
      icon: Bot,
    },
    {
      nameKey: "apiKeys" as const,
      href: "/dashboard/api-keys",
      icon: Key,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {isMobileMenuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          aria-label={tCommon("closeMenu")}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ) : null}

      <div className="fixed left-0 top-0 z-50 m-4 flex items-center gap-2 lg:hidden">
        <Button
          size="icon"
          variant="outline"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          aria-expanded={isMobileMenuOpen}
          aria-label={tCommon("openMenu")}
        >
          <Menu />
        </Button>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div
            className={cn(
              "flex items-center border-b border-sidebar-border px-6",
              DASHBOARD_TOPBAR_HEIGHT_CLASS
            )}
          >
            <Link
              href="/dashboard"
              className="flex min-w-0 items-center gap-2 text-sm font-semibold text-sidebar-foreground transition-colors hover:text-sidebar-primary"
            >
              <img
                src="/logo.svg"
                alt={t("logoAlt")}
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-md"
              />
              <span className="truncate">{tCommon("appName")}</span>
            </Link>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
            {navigation.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.nameKey}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="size-5 shrink-0 opacity-80" />
                  {t(item.nameKey)}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="size-4 shrink-0" />
              {t("signOut")}
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex h-svh min-h-0 flex-col overflow-hidden bg-background lg:pl-64">
        <header
          className={cn(
            "z-20 flex border-b border-border bg-background/95 backdrop-blur-sm",
            "px-4 sm:px-6 lg:px-8",
            "max-lg:flex-col max-lg:gap-2 max-lg:pb-2.5 max-lg:pl-14",
            "max-lg:pt-[calc(env(safe-area-inset-top,0)+4rem)]",
            "lg:flex-row lg:items-center lg:justify-between lg:gap-3",
            "lg:h-14 lg:shrink-0"
          )}
        >
          <DashboardBreadcrumb className="min-w-0 flex-1" />
          <div className="flex shrink-0 justify-end sm:justify-start">
            <TopBarActions />
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
