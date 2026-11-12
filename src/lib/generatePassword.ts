const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function randomChar(charset: string): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return charset[bytes[0] % charset.length];
}

/**
 * Generates a random password (default 12 chars) guaranteed to include at
 * least one uppercase letter, lowercase letter, digit, and symbol. Safe to
 * call client-side (uses the Web Crypto API, no server-only dependencies).
 */
export function generatePassword(length = 12): string {
  const required = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGITS), randomChar(SYMBOLS)];
  const rest = Array.from({ length: Math.max(0, length - required.length) }, () => randomChar(ALL));
  const chars = [...required, ...rest];

  // Shuffle so the guaranteed characters aren't always at the start.
  for (let i = chars.length - 1; i > 0; i--) {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const j = bytes[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
