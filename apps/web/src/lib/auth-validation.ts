export type PasswordValidationKey =
  | "passwordLength"
  | "passwordUpper"
  | "passwordLower"
  | "passwordNumber";

export type UsernameValidationKey = "usernameLength" | "usernameInvalid";

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 64;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function getPasswordValidationKey(
  password: string
): PasswordValidationKey | null {
  if (password.length < 8) return "passwordLength";
  if (!/[A-Z]/.test(password)) return "passwordUpper";
  if (!/[a-z]/.test(password)) return "passwordLower";
  if (!/[0-9]/.test(password)) return "passwordNumber";
  return null;
}

export function getUsernameValidationKey(
  username: string
): UsernameValidationKey | null {
  const name = username.trim();
  if (name.length < USERNAME_MIN_LENGTH || name.length > USERNAME_MAX_LENGTH) {
    return "usernameLength";
  }
  if (!USERNAME_PATTERN.test(name)) {
    return "usernameInvalid";
  }
  return null;
}
