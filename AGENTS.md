# AGENTS.md — Costaff ATS

Costaff ATS is a single-tenant Applicant Tracking System for a staffing company, built with Next.js 15 (App Router, React 19, TypeScript) on PostgreSQL via Prisma 7. It replaces a 9-sheet Excel tracker with a live, role-aware web app: demands/requirements with clone & assignment (one AM/SPOC contact + many recruiters), a candidate master pool with duplicate detection and Excel bulk import, a per-demand candidate pipeline with an event timeline, interviews with a global calendar and per-scope round configuration, offers/onboarding+BGV, company master, users & roles, notifications, performance reports and a dashboard. Auth is a hand-rolled HS256 JWT session cookie plus middleware; RBAC is enforced by shared predicates in `src/lib/auth/*` (server side is the boundary, UI gates are UX only).

## Docs — read the one you need

| File | Read it when |
|---|---|
| `docs/PRD.md` | The task is about features, scope, user behavior or acceptance criteria |
| `docs/ARCHITECTURE.md` | The task touches structure, data flow, DB, API routes, auth or deployment |
| `docs/RULES.md` | **ALWAYS, before writing any code** |
| `docs/ROLES_AND_PERMISSIONS.md` | The task touches any role, permission, visibility or notification rule (canonical spec) |

## Quick file map

| Path | What it is |
|---|---|
| `prisma/schema.prisma` | Full data model (plural snake_case models) |
| `src/middleware.ts` | Cookie-based route guard (non-API paths) |
| `src/lib/db/prisma.ts` | Prisma singleton (`PrismaPg` adapter) — import client from `@/generated/prisma/client` |
| `src/lib/auth/jwt.ts` / `session.ts` | JWT sign/verify; `requireAuth` / `requireRole` / `AuthError` |
| `src/lib/auth/demandPermissions.ts` | Demand CRUD + assignment predicates |
| `src/lib/auth/demandFulfillmentPermissions.ts` | Pipeline / interview / onboarding / settings predicates |
| `src/lib/demandFulfillment/constants.ts` | Status machines, enum values, SLA constants, settings-list normalizers (`isActive`) |
| `src/components/interviewRounds/SettingsItemRowActions.tsx` | Shared settings row actions (pencil, trash, Active/Inactive switch, Inactive badge) — used by every Demand Fulfillment Settings tab |
| `src/lib/demandFulfillment/statusTransitions.ts` | Allowed demand + pipeline transitions |
| `src/lib/companies/companyInterviewRounds.ts` | **The only** writer of company interview rounds |
| `src/lib/companies/companyExperienceLevels.ts` | Company-recommended experience levels (trim / dedupe / order rules) |
| `src/lib/companies/companySpoc.ts` | Company SPOC lookup + `spoc` role validation |
| `src/components/settings/ChipListEditor.tsx` | Shared add/remove chip list (Company experience levels) |
| `src/components/settings/SuggestionChips.tsx` | Shared "Or select an existing …" chip row (rounds + levels) |
| `src/lib/bulk/workbook.ts` | Shared bulk-import core: workbook parsing, header→field matching, row/size limits |
| `src/components/bulk/ImportModal.tsx` | Shared upload → column mapping → preview → result modal (Demands, Companies) |
| `src/lib/queryKeys.ts` | Central React Query keys (add new keys here) |
| `src/app/api/candidates/route.ts` | Reference API handler (auth → filters → visibility → pagination → errors) |
| `src/app/(app)/demands/page.tsx` | Reference page container (Redux list state → query → view + modals) |
| `src/components/demands/demand.schema.ts` | Reference zod schema, shared by form and API |
| `src/services/candidate.service.ts` | Reference axios service wrapper |
| `src/queries/candidates/useCandidatesQuery.ts` | Reference query hook (+ `useCandidateMutations.ts`) |
| `src/lib/navigation/routes.ts` | Sidebar / nav / active-state single source of truth |
| `src/features/listState/listStateSlice.ts` | Redux per-list search/filter/pagination state |
| `src/app/(app)/layout.tsx` | Authenticated shell (`AppShell`) wrapping all `(app)` routes |

## Token-saving instructions for the agent

- **Do NOT** scan or analyze the whole project for a task. Read this file plus the one relevant doc first, then open only the specific files you need.
- Prefer targeted search (`grep` for symbols, `glob` for paths) over reading directories or listing trees.
- Start from the "Key entry points" tables at the end of `docs/ARCHITECTURE.md` instead of exploring from scratch.
- Copy the shape of the nearest existing file (route handler, page container, service, query hook, schema) instead of inventing a new pattern.
- Follow `docs/RULES.md` strictly: named permission predicates, zod schemas, `queryKeys`, services-only axios, `@/generated/prisma` imports.
- Never edit `src/generated/prisma/**`, existing migrations, `.env`, or lockfiles.
- If a task changes structure, features, routes, libraries, permissions or env vars, make the matching small edit in `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/RULES.md` or `docs/ROLES_AND_PERMISSIONS.md` at the end — do not rewrite them.
- Verify before finishing: `npx tsc --noEmit`, `npm test`, `npm run lint`, plus a manual check of the touched flow.