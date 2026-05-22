"use client";

import { useEffect, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";

export type DashboardAuthStatus =
  | "pending"
  | "authenticated"
  | "unauthenticated";

export function useDashboardAuth(): DashboardAuthStatus {
  const router = useRouter();
  const [status, setStatus] = useState<DashboardAuthStatus>("pending");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("unauthenticated");
      router.replace("/login");
      return;
    }

    let cancelled = false;

    api
      .post("/api/auth/test-token", undefined, { skipAuthRedirect: true })
      .then(() => {
        if (!cancelled) {
          setStatus("authenticated");
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        if (!cancelled) {
          setStatus("unauthenticated");
          router.replace("/login");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return status;
}
