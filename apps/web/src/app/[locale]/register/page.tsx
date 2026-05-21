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

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tv = useTranslations("auth.validation");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationErrors((prev) => ({
        ...prev,
        email: tv("emailInvalid"),
      }));
      return false;
    }
    setValidationErrors((prev) => ({ ...prev, email: "" }));
    return true;
  };

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      setValidationErrors((prev) => ({
        ...prev,
        password: tv("passwordLength"),
      }));
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      setValidationErrors((prev) => ({
        ...prev,
        password: tv("passwordUpper"),
      }));
      return false;
    }
    if (!/[a-z]/.test(password)) {
      setValidationErrors((prev) => ({
        ...prev,
        password: tv("passwordLower"),
      }));
      return false;
    }
    if (!/[0-9]/.test(password)) {
      setValidationErrors((prev) => ({
        ...prev,
        password: tv("passwordNumber"),
      }));
      return false;
    }
    setValidationErrors((prev) => ({ ...prev, password: "" }));
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setValidationErrors({ email: "", password: "", confirmPassword: "" });

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (password !== confirmPassword) {
      setValidationErrors((prev) => ({
        ...prev,
        confirmPassword: tv("passwordsMismatch"),
      }));
      return;
    }

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    try {
      await api.post("/api/auth/register", {
        username,
        email,
        password,
      });

      router.push("/login");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("registerFailed"));
      }
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
            <CardDescription>{t("registerSubtitle")}</CardDescription>
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
                    autoComplete="username"
                    placeholder={t("usernamePlaceholder")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder={t("emailPlaceholder")}
                    aria-invalid={Boolean(validationErrors.email)}
                    onChange={(e) => validateEmail(e.target.value)}
                  />
                  {validationErrors.email ? (
                    <p className="text-sm text-destructive">
                      {validationErrors.email}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder={t("passwordCreatePlaceholder")}
                    aria-invalid={Boolean(validationErrors.password)}
                    onChange={(e) => validatePassword(e.target.value)}
                  />
                  {validationErrors.password ? (
                    <p className="text-sm text-destructive">
                      {validationErrors.password}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder={t("confirmPasswordPlaceholder")}
                    aria-invalid={Boolean(validationErrors.confirmPassword)}
                  />
                  {validationErrors.confirmPassword ? (
                    <p className="text-sm text-destructive">
                      {validationErrors.confirmPassword}
                    </p>
                  ) : null}
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

              <Button type="submit" className="w-full">
                {t("createAccount")}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <Button variant="link" className="text-muted-foreground" asChild>
              <Link href="/login">{t("haveAccount")}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
