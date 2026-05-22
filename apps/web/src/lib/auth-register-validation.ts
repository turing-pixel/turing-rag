import {
  getPasswordValidationKey,
  getUsernameValidationKey,
} from "@/lib/auth-validation";

export type RegisterFieldErrors = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export const emptyRegisterFieldErrors = (): RegisterFieldErrors => ({
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
});

type ValidationMessages = {
  usernameLength: string;
  usernameInvalid: string;
  emailInvalid: string;
  passwordLength: string;
  passwordUpper: string;
  passwordLower: string;
  passwordNumber: string;
  passwordsMismatch: string;
};

export function validateRegisterForm(
  values: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  },
  messages: ValidationMessages
): { valid: boolean; errors: RegisterFieldErrors } {
  const errors = emptyRegisterFieldErrors();

  const usernameKey = getUsernameValidationKey(values.username);
  if (usernameKey) {
    errors.username = messages[usernameKey];
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(values.email)) {
    errors.email = messages.emailInvalid;
  }

  const passwordKey = getPasswordValidationKey(values.password);
  if (passwordKey) {
    errors.password = messages[passwordKey];
  }

  if (values.password !== values.confirmPassword) {
    errors.confirmPassword = messages.passwordsMismatch;
  }

  const valid = !Object.values(errors).some(Boolean);
  return { valid, errors };
}

export function validateRegisterField(
  field: keyof RegisterFieldErrors,
  values: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  },
  messages: ValidationMessages
): string {
  return validateRegisterForm(values, messages).errors[field];
}
