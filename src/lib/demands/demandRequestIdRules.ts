// Rule: a manually typed Requirement ID is A-Za-z0-9-_ only, 3-30 chars, stored uppercase.
// Kept free of Prisma so the form and the API validate with the same constants.
// A blank value is valid: it means "auto-generate on save".
// A demand saved before these rules keeps its old ID; nothing here rewrites existing rows.

export const DEMAND_REQUEST_ID_MIN_LENGTH = 3;
export const DEMAND_REQUEST_ID_MAX_LENGTH = 30;

export const DEMAND_REQUEST_ID_ALLOWED_CHARS_RE = /^[A-Za-z0-9_-]+$/;

// A leading "-" or "_" is not a usable ID, so the first character has its own rule.
export const DEMAND_REQUEST_ID_START_RE = /^[A-Za-z0-9]/;

export const DEMAND_REQUEST_ID_HINT = 'Letters, numbers, - and _ only. 3 to 30 characters.';

// Exact wording required for the reserved auto-generated format.
export const DEMAND_REQUEST_ID_RESERVED_MESSAGE = 'This format is reserved for auto-generated IDs';

// The generator's own scheme, so a manual ID can never impersonate a generated one.
export const DEMAND_REQUEST_ID_RESERVED_RE = /^CSF-\d{4}-\d{4}$/i;

export const DEMAND_REQUEST_ID_LENGTH_MESSAGE = `Request ID must be between ${DEMAND_REQUEST_ID_MIN_LENGTH} and ${DEMAND_REQUEST_ID_MAX_LENGTH} characters`;
export const DEMAND_REQUEST_ID_CHARS_MESSAGE = 'Request ID can only contain letters, numbers, hyphens and underscores';
export const DEMAND_REQUEST_ID_START_MESSAGE = 'Request ID must start with a letter or a number';

// Stored form: trim, then uppercase. An illegal character is rejected, never silently removed.
export function normalizeDemandRequestId(raw: string): string {
  return raw.trim().toUpperCase();
}

// Applied on every keystroke and on paste, so the field never holds a character it disallows.
export function sanitizeDemandRequestIdInput(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9_-]/g, '')
    .toUpperCase()
    .slice(0, DEMAND_REQUEST_ID_MAX_LENGTH);
}

export function isReservedDemandRequestId(value: string): boolean {
  return DEMAND_REQUEST_ID_RESERVED_RE.test(value.trim());
}

export function validateDemandRequestId(raw: string | null | undefined): { ok: true; value: string } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: '' };
  const value = normalizeDemandRequestId(raw);
  if (value === '') return { ok: true, value: '' };

  if (value.length < DEMAND_REQUEST_ID_MIN_LENGTH || value.length > DEMAND_REQUEST_ID_MAX_LENGTH) {
    return { ok: false, error: DEMAND_REQUEST_ID_LENGTH_MESSAGE };
  }
  if (!DEMAND_REQUEST_ID_ALLOWED_CHARS_RE.test(value)) {
    return { ok: false, error: DEMAND_REQUEST_ID_CHARS_MESSAGE };
  }
  if (!DEMAND_REQUEST_ID_START_RE.test(value)) {
    return { ok: false, error: DEMAND_REQUEST_ID_START_MESSAGE };
  }
  if (isReservedDemandRequestId(value)) {
    return { ok: false, error: DEMAND_REQUEST_ID_RESERVED_MESSAGE };
  }
  return { ok: true, value };
}

export function duplicateDemandRequestIdMessage(value: string): string {
  return `Request ID "${value}" already exists`;
}