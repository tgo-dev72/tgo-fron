export type RegistrationFailureField =
  | "email"
  | "phone"
  | "password"
  | "confirmation"
  | "terms"
  | "identity"
  | "general";

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "qwerty123",
  "admin123",
  "welcome123",
  "letmein123",
  "12345678a",
  "azerty123",
]);

function comparable(value: string): string {
  return value.normalize("NFKD").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function merchantPasswordRules(input: {
  password: string;
  email: string;
  firstName: string;
  lastName: string;
}) {
  const normalizedPassword = comparable(input.password);
  const identityTerms = [
    input.email.split("@", 1)[0],
    input.firstName,
    input.lastName,
  ]
    .map(comparable)
    .filter((value) => value.length >= 4);
  return {
    length: input.password.length >= 8,
    letter: /\p{L}/u.test(input.password),
    number: /\d/.test(input.password),
    uncommon: !COMMON_PASSWORDS.has(normalizedPassword),
    personal: !identityTerms.some((term) => normalizedPassword.includes(term)),
  };
}

function hasError(payload: Record<string, unknown> | undefined, key: string): boolean {
  return Boolean(payload && Object.prototype.hasOwnProperty.call(payload, key));
}

/** Convert backend validation shape into a safe, localized UI category. */
export function registrationFailureField(
  payload: Record<string, unknown> | undefined,
): RegistrationFailureField {
  if (hasError(payload, "email")) return "email";
  if (hasError(payload, "phone_number")) return "phone";
  if (hasError(payload, "password") || hasError(payload, "non_field_errors")) return "password";
  if (hasError(payload, "confirm_email") || hasError(payload, "confirm_password")) return "confirmation";
  if (hasError(payload, "terms_accepted")) return "terms";
  if (
    hasError(payload, "first_name")
    || hasError(payload, "last_name")
  ) return "identity";
  return "general";
}
