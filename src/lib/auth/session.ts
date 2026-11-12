import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { verifySessionToken, type SessionPayload } from '@/lib/auth/jwt';

export type UserRole = 'super_admin' | 'account_manager' | 'spoc' | 'hr' | 'ta' | 'viewer';

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function requireAuth(): Promise<SessionPayload> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthError('Unauthorized', 401);
  }

  return user;
}

export async function requireRole(allowedRoles?: (UserRole | string)[]): Promise<SessionPayload> {
  const user = await requireAuth();

  // If specific roles are passed:
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = (allowedRoles as string[]).includes(user.role);
    if (!hasRole && user.role !== 'super_admin') {
      throw new AuthError('Forbidden', 403);
    }
  }

  return user;
}
