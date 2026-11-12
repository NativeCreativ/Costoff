import { useMutation } from '@tanstack/react-query';
import { logout } from '@/services/auth.service';

/**
 * Logs out: clears the httpOnly session cookie server-side (POST /api/auth/logout),
 * then hard-navigates to /login. A hard navigation (not router.push) discards all
 * React/query state by itself, so the whole app re-mounts against the now-anonymous
 * session — no need to clear the query cache first. Clearing it here while the
 * dashboard is still mounted would re-trigger every active query's refetch (still
 * authenticated at that instant), which is what caused a flash of stale dashboard
 * data right before the redirect landed.
 */
export function useLogoutMutation() {
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      window.location.href = '/login';
    },
  });
}
