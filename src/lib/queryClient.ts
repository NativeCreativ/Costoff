import { QueryClient, isServer } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * The React Query client for the current render.
 *
 * Server: a NEW client per request. A module-level client is shared by every request on the
 * server, so one user's cached data (e.g. the current user, seeded by the root layout) leaked
 * into another user's server render — and because HydrationBoundary defers hydrating a query
 * that already exists, the server rendered that stale user while the browser rendered the real
 * one, which broke hydration (sidebar sections differed by role).
 *
 * Browser: one client for the whole session, so the cache survives client-side navigation.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
