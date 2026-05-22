import type { ReactNode } from "react";

import { AuthPageBrand } from "@/components/auth/auth-page-brand";
import { TopBarActions } from "@/components/top-bar-actions";

type AuthPageShellProps = {
  appName: string;
  subtitle: string;
  logoAlt: string;
  children: ReactNode;
};

export function AuthPageShell({
  appName,
  subtitle,
  logoAlt,
  children,
}: AuthPageShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute right-4 top-4">
        <TopBarActions />
      </div>
      <div className="w-full max-w-md">
        <AuthPageBrand
          appName={appName}
          subtitle={subtitle}
          logoAlt={logoAlt}
        />
        {children}
      </div>
    </main>
  );
}
