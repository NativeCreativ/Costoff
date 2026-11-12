import { SignJWT, jwtVerify } from 'jose';

/**
 * Read at call time, via a computed key, so `next build` can load route modules
 * without a secret and the value is not baked into the server bundle.
 */
function encodedSessionSecret(): Uint8Array {
  const secret = process.env['SESSION_SECRET'];
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

const SESSION_DURATION = '7d';

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  [key: string]: unknown;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(encodedSessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSessionSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
