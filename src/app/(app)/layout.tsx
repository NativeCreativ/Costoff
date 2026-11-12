import { AppShell } from "@/components/layout/AppShell";

/**
 * Shared layout for every authenticated application route.
 *
 * The (app) segment is a route group: it does not appear in the URL, so
 * /org-overview, /demands, /candidates … keep their plain paths while all of them
 * share one AppShell. Auth is already enforced by src/middleware.ts, which matches
 * every non-API path.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
