"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopBarActions } from "@/components/top-bar-actions";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");

    try {
      const formUrlEncoded = new URLSearchParams();
      formUrlEncoded.append("username", username as string);
      formUrlEncoded.append("password", password as string);

      const data = await api.post("/api/auth/token", formUrlEncoded, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      localStorage.setItem("token", (data as { access_token: string }).access_token);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("loginFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute right-4 top-4">
        <TopBarActions />
      </div>
      <div className="w-full max-w-md">
        <Card className="shadow-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">
              {t("welcomeTitle", { appName: tCommon("appName") })}
            </CardTitle>
            <CardDescription>{t("signInSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="username">{t("username")}</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    disabled={loading}
                    autoComplete="username"
                    placeholder={t("usernamePlaceholder")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    placeholder={t("passwordPlaceholder")}
                  />
                </div>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("signingIn") : t("signIn")}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <Button variant="link" className="text-muted-foreground" asChild>
              <Link href="/register">{t("noAccount")}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
