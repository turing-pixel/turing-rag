"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Book,
  LayoutDashboard,
  LogOut,
  Key,
  MessageSquare,
  Bot,
  GitBranch,
  Binary,
  User,
  Workflow,
} from "lucide-react";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { TopBarActions } from "@/components/top-bar-actions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useDashboardAuth } from "@/hooks/use-dashboard-auth";
import { cn } from "@/lib/utils";

type NavItemKey =
  | "overview"
  | "knowledgeBase"
  | "chat"
  | "rag"
  | "workflows"
  | "llmConfigs"
  | "embeddingConfigs"
  | "apiKeys"
  | "account";

type NavGroupLabelKey = "groupKnowledge" | "groupSettings" | "groupAccount";

const DASHBOARD_NAV_GROUPS: {
  labelKey?: NavGroupLabelKey;
  items: {
    nameKey: NavItemKey;
    href: string;
    icon: typeof LayoutDashboard;
  }[];
}[] = [
  {
    items: [
      { nameKey: "overview", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    labelKey: "groupKnowledge",
    items: [
      { nameKey: "knowledgeBase", href: "/dashboard/knowledge", icon: Book },
      { nameKey: "chat", href: "/dashboard/chat", icon: MessageSquare },
      { nameKey: "workflows", href: "/dashboard/workflows", icon: Workflow },
      { nameKey: "rag", href: "/dashboard/rag", icon: GitBranch },
    ],
  },
  {
    labelKey: "groupSettings",
    items: [
      { nameKey: "llmConfigs", href: "/dashboard/llm-configs", icon: Bot },
      {
        nameKey: "embeddingConfigs",
        href: "/dashboard/embedding-configs",
        icon: Binary,
      },
      { nameKey: "apiKeys", href: "/dashboard/api-keys", icon: Key },
    ],
  },
  {
    labelKey: "groupAccount",
    items: [
      { nameKey: "account", href: "/dashboard/account", icon: User },
    ],
  },
];

function isNavItemActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(href);
}

/** Close mobile sheet after route changes (replaces manual overlay state). */
function SidebarMobileCloseOnNavigate() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  return null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const authStatus = useDashboardAuth();
  const t = useTranslations("dashboard.nav");
  const tCommon = useTranslations("common");

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  if (authStatus !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        {authStatus === "pending" ? (
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        ) : null}
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <SidebarMobileCloseOnNavigate />
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="h-14 shrink-0 justify-center border-b border-sidebar-border px-4">
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
        </SidebarHeader>

        <SidebarContent>
          {DASHBOARD_NAV_GROUPS.map((group, index) => (
            <SidebarGroup key={group.labelKey ?? `nav-group-${index}`}>
              {group.labelKey ? (
                <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = isNavItemActive(pathname, item.href);
                    const label = t(item.nameKey);
                    return (
                      <SidebarMenuItem key={item.nameKey}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={label}
                        >
                          <Link href={item.href}>
                            <item.icon />
                            <span>{label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut />
                <span>{t("signOut")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="flex h-svh min-h-0 flex-col overflow-hidden">
        <header
          className={cn(
            "flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8"
          )}
        >
          <SidebarTrigger />
          <DashboardBreadcrumb className="min-w-0 flex-1" />
          <TopBarActions showDocumentUpload />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
