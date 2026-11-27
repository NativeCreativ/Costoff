import { cookies, headers } from 'next/headers';
import { REQUEST_PATH_HEADER } from '@/lib/auth/requestPath';
import { canUseModule, moduleForApiPath } from '@/lib/auth/moduleAccess';
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

/** Path of the API request being handled, as set by the middleware; null outside a request. */
async function currentRequestPath(): Promise<string | null> {
  try {
    return (await headers()).get(REQUEST_PATH_HEADER);
  } catch {
    return null;
  }
}

/**
 * Refuses an API that belongs to a screen the Delivery Head switched off for this employee.
 * Read from the database on each call, so a change applies at once, not at the next login.
 */
async function assertModuleAccess(user: SessionPayload): Promise<void> {
  if (user.role === 'super_admin') return;
  const path = await currentRequestPath();
  const accessModule = path ? moduleForApiPath(path) : undefined;
  if (!accessModule) return;

  const { prisma } = await import('@/lib/db/prisma');
  const profile = await prisma.profiles.findUnique({ where: { id: user.userId }, select: { blocked_modules: true } });
  if (!canUseModule(user.role, profile?.blocked_modules, accessModule.key)) {
    throw new AuthError(`Your access to ${accessModule.label} has been turned off. Ask your Delivery Head.`, 403);
  }
}

export async function requireAuth(): Promise<SessionPayload> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthError('Unauthorized', 401);
  }

  await assertModuleAccess(user);
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
