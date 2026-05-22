"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import {
  AuthFormAlert,
  AuthFormCard,
  AuthFormFields,
  AuthFormFooterText,
  AuthPasswordField,
  AuthSubmitButton,
  AuthTextField,
} from "@/components/auth/auth-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ApiError } from "@/lib/api";
import { loginWithCredentials } from "@/lib/auth-session";

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
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    try {
      await loginWithCredentials(username, password);
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
    <AuthPageShell
      appName={tCommon("appName")}
      subtitle={t("signInSubtitle")}
      logoAlt={tCommon("appName")}
    >
      <AuthFormCard
        title={t("signIn")}
        footer={
          <AuthFormFooterText>
            {t("noAccount")}{" "}
            <Link
              href="/register"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("createAccount")}
            </Link>
          </AuthFormFooterText>
        }
      >
        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          <AuthFormFields>
            <AuthTextField
              id="username"
              name="username"
              label={t("username")}
              placeholder={t("usernamePlaceholder")}
              icon="user"
              disabled={loading}
              autoComplete="username"
            />
            <AuthPasswordField
              id="password"
              name="password"
              label={t("password")}
              placeholder={t("passwordPlaceholder")}
              disabled={loading}
              autoComplete="current-password"
              showToggleLabel={{
                show: t("showPassword"),
                hide: t("hidePassword"),
              }}
            />
          </AuthFormFields>

          {error ? <AuthFormAlert message={error} /> : null}

          <AuthSubmitButton
            loading={loading}
            loadingLabel={t("signingIn")}
            label={t("signIn")}
          />
        </form>
      </AuthFormCard>
    </AuthPageShell>
  );
}
