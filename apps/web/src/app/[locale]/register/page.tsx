"use client";

import { useCallback, useState } from "react";
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
import { api, ApiError } from "@/lib/api";
import { loginWithCredentials } from "@/lib/auth-session";
import {
  emptyRegisterFieldErrors,
  validateRegisterField,
  validateRegisterForm,
  type RegisterFieldErrors,
} from "@/lib/auth-register-validation";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tv = useTranslations("auth.validation");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>(
    emptyRegisterFieldErrors
  );
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const validationMessages = {
    usernameLength: tv("usernameLength"),
    usernameInvalid: tv("usernameInvalid"),
    emailInvalid: tv("emailInvalid"),
    passwordLength: tv("passwordLength"),
    passwordUpper: tv("passwordUpper"),
    passwordLower: tv("passwordLower"),
    passwordNumber: tv("passwordNumber"),
    passwordsMismatch: tv("passwordsMismatch"),
  };

  const passwordToggleLabel = {
    show: t("showPassword"),
    hide: t("hidePassword"),
  };

  const updateValue = useCallback(
    (field: keyof typeof values, value: string) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value };
        setFieldErrors((errors) => {
          const nextErrors = {
            ...errors,
            [field]: validateRegisterField(field, next, validationMessages),
          };
          if (field === "password" && next.confirmPassword) {
            nextErrors.confirmPassword = validateRegisterField(
              "confirmPassword",
              next,
              validationMessages
            );
          }
          return nextErrors;
        });
        return next;
      });
    },
    [validationMessages]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const nextValues = {
      username: formData.get("username") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };
    setValues(nextValues);

    const { valid, errors } = validateRegisterForm(
      nextValues,
      validationMessages
    );
    setFieldErrors(errors);
    if (!valid) {
      return;
    }

    setLoading(true);
    try {
      await api.post(
        "/api/auth/register",
        {
          username: nextValues.username.trim(),
          email: nextValues.email,
          password: nextValues.password,
        },
        { skipAuthRedirect: true }
      );

      await loginWithCredentials(
        nextValues.username.trim(),
        nextValues.password
      );
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("registerFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      appName={tCommon("appName")}
      subtitle={t("registerSubtitle")}
      logoAlt={tCommon("appName")}
    >
      <AuthFormCard
        title={t("createAccount")}
        footer={
          <AuthFormFooterText>
            {t("haveAccount")}{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("signIn")}
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
              error={fieldErrors.username}
              onChange={(e) => updateValue("username", e.target.value)}
            />
            <AuthTextField
              id="email"
              name="email"
              type="email"
              label={t("email")}
              placeholder={t("emailPlaceholder")}
              icon="mail"
              disabled={loading}
              autoComplete="email"
              error={fieldErrors.email}
              onChange={(e) => updateValue("email", e.target.value)}
            />
            <AuthPasswordField
              id="password"
              name="password"
              label={t("password")}
              placeholder={t("passwordCreatePlaceholder")}
              disabled={loading}
              autoComplete="new-password"
              description={t("passwordHint")}
              error={fieldErrors.password}
              showToggleLabel={passwordToggleLabel}
              onChange={(e) => updateValue("password", e.target.value)}
            />
            <AuthPasswordField
              id="confirmPassword"
              name="confirmPassword"
              label={t("confirmPassword")}
              placeholder={t("confirmPasswordPlaceholder")}
              disabled={loading}
              autoComplete="new-password"
              error={fieldErrors.confirmPassword}
              showToggleLabel={passwordToggleLabel}
              onChange={(e) =>
                updateValue("confirmPassword", e.target.value)
              }
            />
          </AuthFormFields>

          {error ? <AuthFormAlert message={error} /> : null}

          <AuthSubmitButton
            loading={loading}
            loadingLabel={t("creatingAccount")}
            label={t("createAccount")}
          />
        </form>
      </AuthFormCard>
    </AuthPageShell>
  );
}
