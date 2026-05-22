"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import {
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type AuthFormCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthFormCard({
  title,
  description,
  children,
  footer,
}: AuthFormCardProps) {
  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-border/60 pb-4 text-center">
        <CardTitle>{title}</CardTitle>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
      {footer ? (
        <CardFooter className="justify-center border-t border-border/60 pt-4">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function AuthFormFooterText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-center text-sm text-balance text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}

export function AuthFormAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle className="sr-only">Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

type AuthTextFieldProps = {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "email";
  icon?: "user" | "mail";
  disabled?: boolean;
  error?: string;
  description?: string;
  autoComplete?: string;
  onChange?: ComponentProps<"input">["onChange"];
  onBlur?: ComponentProps<"input">["onBlur"];
};

const fieldIcons = {
  user: User,
  mail: Mail,
} as const;

export function AuthTextField({
  id,
  name,
  label,
  placeholder,
  type = "text",
  icon = "user",
  disabled,
  error,
  description,
  autoComplete,
  onChange,
  onBlur,
}: AuthTextFieldProps) {
  const Icon = fieldIcons[icon];
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      <InputGroup>
        <InputGroupAddon>
          <Icon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          required
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [error ? errorId : null, description ? descriptionId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          onChange={onChange}
          onBlur={onBlur}
        />
      </InputGroup>
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}

type AuthPasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  description?: string;
  autoComplete?: string;
  showToggleLabel: { show: string; hide: string };
  onChange?: ComponentProps<"input">["onChange"];
  onBlur?: ComponentProps<"input">["onBlur"];
};

export function AuthPasswordField({
  id,
  name,
  label,
  placeholder,
  disabled,
  error,
  description,
  autoComplete,
  showToggleLabel,
  onChange,
  onBlur,
}: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      <InputGroup>
        <InputGroupAddon>
          <Lock aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          disabled={disabled}
          required
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [error ? errorId : null, description ? descriptionId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          onChange={onChange}
          onBlur={onBlur}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={disabled}
            aria-label={visible ? showToggleLabel.hide : showToggleLabel.show}
            onClick={() => setVisible((value) => !value)}
          >
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}

type AuthFormFieldsProps = {
  children: ReactNode;
  className?: string;
};

export function AuthFormFields({ children, className }: AuthFormFieldsProps) {
  return (
    <FieldSet className={cn("gap-0", className)}>
      <FieldGroup className="gap-4">{children}</FieldGroup>
    </FieldSet>
  );
}

type AuthSubmitButtonProps = {
  loading: boolean;
  loadingLabel: string;
  label: string;
};

export function AuthSubmitButton({
  loading,
  loadingLabel,
  label,
}: AuthSubmitButtonProps) {
  return (
    <Button type="submit" className="w-full" disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
