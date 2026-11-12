/** Trims and lowercases so email comparisons/uniqueness are case- and whitespace-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Strips all non-digit characters so phone numbers compare equal regardless of formatting (+, spaces, dashes). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}
