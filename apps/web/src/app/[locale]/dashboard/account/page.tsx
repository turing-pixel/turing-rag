"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  PreferenceModelItem,
  type ModelDefaultPreference,
} from "@/components/account/preference-model-item";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ItemGroup,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

interface UserProfile {
  email: string;
  username: string;
  is_active: boolean;
  is_superuser: boolean;
  uuid: string;
  created_at: string;
  updated_at: string;
}

interface UserPreferences {
  default_llm: ModelDefaultPreference;
  default_embedding: ModelDefaultPreference;
}

export default function AccountPage() {
  const t = useTranslations("accountPage");
  const tToast = useTranslations("toasts");
  const locale = useLocale();
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [user, prefs] = await Promise.all([
          api.get("/api/auth/me") as Promise<UserProfile>,
          api.get("/api/auth/preferences") as Promise<UserPreferences>,
        ]);
        if (cancelled) return;
        setProfile(user);
        setPreferences(prefs);
        setEmail(user.email);
        setUsername(user.username);
      } catch {
        if (!cancelled) {
          toast.error(tToast("accountLoadError"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tToast]);

  const handleSave = async () => {
    if (!profile) return;

    const payload: {
      email?: string;
      username?: string;
      password?: string;
    } = {};

    if (email.trim() !== profile.email) {
      payload.email = email.trim();
    }
    if (username.trim() !== profile.username) {
      payload.username = username.trim();
    }
    if (password.trim()) {
      payload.password = password;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = (await api.patch(
        "/api/auth/me",
        payload
      )) as UserProfile;
      setProfile(updated);
      setEmail(updated.email);
      setUsername(updated.username);
      setPassword("");
      toast.success(tToast("accountUpdateSuccess"));
    } catch {
      toast.error(tToast("accountUpdateError"));
    } finally {
      setIsSaving(false);
    }
  };

  const hasProfileChanges =
    profile !== null &&
    (email.trim() !== profile.email ||
      username.trim() !== profile.username ||
      password.trim().length > 0);

  if (isLoading) {
    return (
      <DashboardPageContainer>
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardPageContainer>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <DashboardPageContainer>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("profileSection")}</CardTitle>
            <CardDescription>{t("profileDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">{t("username")}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                autoComplete="new-password"
              />
            </div>

            <Separator />

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("uuid")}</dt>
                <dd className="mt-1 font-mono text-xs">{profile.uuid}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("role")}</dt>
                <dd className="mt-1">
                  {profile.is_superuser ? t("roleAdmin") : t("roleUser")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("status")}</dt>
                <dd className="mt-1">
                  {profile.is_active ? t("statusActive") : t("statusInactive")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("memberSince")}</dt>
                <dd className="mt-1">
                  {new Date(profile.created_at).toLocaleDateString(dateLocale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
              </div>
            </dl>

            <Button
              onClick={handleSave}
              disabled={isSaving || !hasProfileChanges}
            >
              {isSaving ? t("saving") : t("save")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("preferencesSection")}</CardTitle>
            <CardDescription>{t("preferencesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {preferences ? (
              <ItemGroup>
                <PreferenceModelItem
                  pref={preferences.default_llm}
                  manageHref="/dashboard/llm-configs"
                  manageLabel={t("manageLlm")}
                  kind="llm"
                />
                <PreferenceModelItem
                  pref={preferences.default_embedding}
                  manageHref="/dashboard/embedding-configs"
                  manageLabel={t("manageEmbedding")}
                  kind="embedding"
                />
              </ItemGroup>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardPageContainer>
  );
}
