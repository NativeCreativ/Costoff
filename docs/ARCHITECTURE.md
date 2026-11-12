# Architecture — Costaff ATS

Reverse-engineered from the code. Read alongside `docs/PRD.md` (what) and `docs/RULES.md` (how to work).

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js `^15.2.0`, App Router, React 19, TypeScript `^5.7` | `next.config.js`; server actions body limit 50 MB |
| Runtime | Node (route handlers + a few `tsx` scripts) | `src/app/api/**/route.ts` |
| DB | PostgreSQL via Prisma `7.10.0` + `@prisma/adapter-pg` | Driver adapter, connection string from `DATABASE_URL` |
| Client | Generated into `src/generated/prisma` (`prisma-client`, not `-js`) | **Never import from `@prisma/client`** |
| Server state | TanStack Query v5 (`@tanstack/react-query`) | Keys centralised in `src/lib/queryKeys.ts` |
| Cross-route UI state | Redux Toolkit `listState` slice only | Filters/pagination survive route changes |
| HTTP | `axios` instance `api` with `baseURL: '/api'` (`src/lib/axios.ts`) | Services only; components never call axios |
| Auth | Hand-rolled HS256 JWT (`jose`) in an httpOnly-style cookie + `src/middleware.ts` | No NextAuth/Supabase auth (Supabase deps are legacy, unused for auth) |
| Validation | `zod` v4 — schemas live next to the form in `components/<module>/<name>.schema.ts` | Same schema reused server-side in routes |
| Forms | `react-hook-form` + `@hookform/resolvers` | |
| UI | Tailwind CSS 3.4 + shadcn/ui primitives in `src/components/ui` (Radix + CVA + `cn`) | Base color `slate`, CSS variables in `globals.css` |
| Charts | `chart.js` + `react-chartjs-2`, registered centrally in `components/charts/chartRegistration.ts` | |
| Calendar | FullCalendar (`daygrid`, `timegrid`, `interaction`) | |
| Email | `nodemailer` (`src/lib/email.ts`, `src/services/smtp.service.ts`) | Reset password + SMTP test only |
| Excel | `exceljs` (import/export) + `xlsx` (scripts) | |
| Tests | Vitest 5, `src/**/*.test.ts`, node env | Two test files exist today |
| Deploy | GitHub Actions (`.github/workflows/deploy.yml`) | Builds and deploys the Next app |

### Environment variables (names only — see `.env` keys, never values)

`DATABASE_URL`, `SHADOW_DATABASE_URL`, `SESSION_SECRET` (read when a token is signed or verified in `src/lib/auth/jwt.ts` — throws if missing at that moment), `COOKIE_SECURE` (optional override for the session cookie Secure flag; unset follows the request protocol and `x-forwarded-proto`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `NODE_ENV`.
There is **no `.env.example`** in the repo — the above is derived from `.env` key names and `prisma7.config.ts`.

## 2. Overall flow

### Frontend
1. `src/middleware.ts` runs on every non-API path (matcher excludes `api`, `_next/static`, `_next/image`, `favicon.ico`). It verifies the `session_token` cookie; no session → redirect `/login`; session on an auth page → redirect `/`.
2. Authenticated pages live under the `(app)` route group (`src/app/(app)/**`) and share `AppShell` (`components/layout/AppShell.tsx`: sidebar + header + notification bell). The group does not appear in URLs.
3. Each route page is a `'use client'` container: it reads list state from Redux, calls a query hook, and renders a presentational `*View` + modals. Modals hold form state and call mutation hooks.
4. Server components are the exception: `src/app/layout.tsx` / `(app)/layout.tsx`; SSR may seed the current user via `getCurrentUserProfile()` + React Query `HydrationBoundary`.

### Backend
1. Route handlers under `src/app/api/**/route.ts`, one file per resource path (some are non-REST: `PUT /api/candidates` with `id` in the body, `DELETE` with params).
2. Each handler: `requireAuth()` / `requireRole([...])` → parse pagination/filters → build a `Prisma...WhereInput` (or `Prisma.Sql` for raw SQL) with a visibility condition → query → `NextResponse.json(...)`.
3. Writes additionally call a named permission predicate from `src/lib/auth/*`, validate with the module's zod schema, write event/audit rows, and create notifications where applicable.

### End-to-end (example: recruiter moves a candidate to "Shortlisted Internal")
1. UI action in `PipelineKanbanBoard.tsx` → `useSubmissionStatusMutation` (`src/queries/demands/useDemandMutations.ts`).
2. `src/services/demandFulfillment.service.ts` → `api.post('/demands/:requestId/candidates/:dcId/status', body)` (axios instance).
3. `src/app/api/demands/[requestId]/candidates/[dcId]/status/route.ts`: `requireAuth()` → resolve demand (`loadDemandContext`) → `canManageDemandPipeline(actor, demand)` → validate transition against `statusTransitions.ts` → mandatory-remark rules (`DEMAND_STATUS_REQUIRES_REMARK`) → transaction: update `submissions` + insert `submission_events`.
4. Response 200 → mutation `onSuccess` invalidates `queryKeys.demandCandidates(...)` → React Query refetches → board re-renders.
5. On error: axios error → `err.response.data.error` → `toast.error(title, msg)`; console.error for diagnostics.

## 3. System components

| Component | Location | Responsibility |
|---|---|---|
| Middleware | `src/middleware.ts` | Cookie-based route protection |
| Session/JWT | `src/lib/auth/{jwt,session,constants,password}.ts` | Sign/verify token, `requireAuth`/`requireRole`, `AuthError` |
| Permissions | `src/lib/auth/{demandPermissions,candidatePermissions,companyPermissions,demandFulfillmentPermissions,interviewPermissions,recordPermissions,notifications/permissions}.ts` + `creatorScope`, `demandVisibility`, `recruiterRole` | All role/ownership predicates (shared, importable from client and server) |
| DB layer | `src/lib/db/prisma.ts` | Singleton `PrismaClient` with `PrismaPg` adapter |
| Domain libs | `src/lib/demandFulfillment/*`, `src/lib/demands/*`, `src/lib/lifecycle/*`, `src/lib/candidates/*`, `src/lib/notifications/*`, `src/lib/companies/*`, `src/lib/auth/*` | State machines, aging query, clone mapping, dedupe, round resolution, **the single owner of company interview rounds** |
| Services | `src/services/*.service.ts` | Thin axios wrappers, one per module, returning plain shapes |
| Query layer | `src/queries/**/use*Query.ts` / `use*Mutations.ts` | React Query wrappers + cache invalidation |
| Redux | `src/redux/*`, `src/features/listState/listStateSlice.ts` | Per-list search/filter/page persistence |
| UI | `src/components/{ui,layout,dashboard,demands,demandFulfillment,candidates,interviews,offers,companies,users,charts,performance,notifications,settings,crm,lifecycle,logs,connections,interviewRounds,auth}` | Views, rows, forms, modals, shadcn primitives |
| Constants | `src/constants/*.ts`, `src/lib/demandFulfillment/constants.ts`, `src/components/*/*.schema.ts` | Enum-like value lists, search/filter field maps, zod schemas |
| Scripts | `scripts/*.ts|js|mjs|py` | Seeding, super-admin creation, closure cron, Excel import, DB reset |

### Demand Fulfillment Settings page layout

`src/app/(app)/settings/demand-fulfillment/page.tsx` → `SuperAdminSettingsView.tsx` renders a two-column
layout: `SettingsMenu.tsx` (left, ~190px, grouped section list from `settingsSections.ts`, horizontal
scrollable tabs on small screens) and a right content area that shows exactly one `SettingsPanel` at a
time via CSS (`hidden`/`block`), never by unmounting. There is no page-level "Save Settings" flow: every
section saves itself directly through `PUT /api/admin/settings/demand-fulfillment` the moment the user
acts — add/rename/delete/reorder/a Mandatory-or-Required toggle call immediately, text edits and the
Resume Cap number save on blur/Enter. That endpoint accepts a **partial** body (one field per call —
`SuperAdminSettingsPatch`); an unsent field is left untouched. `SuperAdminSettingsView` only wires the
`GET` cache through to whichever section is visible — `ResumeCapSection`,
`OnboardingChecklistSection`, `BgvChecklistSection`
(the last two share the add/rename/delete/reorder editor in `SettingsChecklistSection.tsx`). Each
section validates (trim, non-empty, case-insensitive duplicate; Resume Cap must be a positive integer)
before calling the API and shows an inline error without calling it on failure; a request that does
reach the API shows a success/error toast and reverts the control on failure. Compensation Currency/Type
and the Skills Library already worked this way before this page existed and are unchanged here, via
their own mutations (`useCompensationMastersMutations`, `useSkillsLibraryMutations`).

### Settings item lifecycle (Edit / Delete / Active-Inactive)

Every remaining settings list tab shares one lifecycle and one row UI. **Default interview rounds,
Interview modes and Experience levels were removed entirely** (UI, data and APIs) — see "Demand
Fulfillment Settings — removed tabs" below. What follows describes the tabs still standing:
Compensation Currency/Type, Skills Library, Onboarding documents, BGV checklist.

- **`isActive` on every list.** Table-backed lists carry a real `is_active` column
  (`compensation_currencies`, `compensation_types`, `skill_categories`, `skills`). The two
  remaining JSON lists in `super_admin_settings` carry an `isActive` key per item in code only —
  `onboarding_document_checklist`, `bgv_checklist`. An item without the key is read as active;
  normalizers (`normalizeOnboardingChecklist`, `normalizeBgvChecklist` in
  `src/lib/demandFulfillment/constants.ts`) read both shapes and always emit objects. Nothing is
  bulk-rewritten.
- **`includeInactive` flag.** Every settings list endpoint accepts `?includeInactive=true` and
  returns inactive rows plus per-item usage counts; the **default (no flag) returns ACTIVE items
  only**, so existing form pickers are unaffected. Only users who pass the section's own permission
  gate may use the flag. The settings screen therefore uses **separate query keys**
  (`superAdminSettingsDFIncludeInactive`, `compensationCurrenciesIncludeInactive`,
  `compensationTypesIncludeInactive`, `skillsLibraryIncludeInactive`) from the form pickers', and
  refetches on mount so usage counts and menu badges stay fresh. Mutations invalidate both keys.
- **Shared row actions.** `SettingsItemRowActions.tsx` renders the icon-only pencil, trash, the
  Active/Inactive switch and the muted "Inactive" badge. Disabled controls expose their tooltip on
  hover **and** keyboard focus (focusable wrapper, `aria-disabled`, `aria-describedby`); the switch
  has `aria-label` "Deactivate &lt;name&gt;" / "Activate &lt;name&gt;". Every remaining tab uses it.
- **In use (referenced by real records).** Edit and Delete are **disabled** with a tooltip naming
  only the non-zero usage kinds. The Active/Inactive toggle stays enabled, as do Mandatory/Required
  toggles and drag reorder. The server enforces the same rule inside the write transaction (`409`);
  the frontend 409 handling is a race fallback that toasts and refreshes usage counts.
- **In use sources.** Compensation currency / type: `demands.compensation_currency_id` /
  `compensation_type_id` (grouped queries, no N+1). Skills: `demands.technology_stack` and
  `candidates.skills`. Onboarding documents: `onboardings.documents_status`. **BGV checklist has no
  runtime consumer** — `bgv_status` is hardcoded, so its usage is always 0 and edit/delete stay
  enabled. Skills **category** rename is always allowed (the category is not stored on records);
  delete is rejected when any of its skills is in use; deactivating a category hides it and its
  skills from the picker while saved skills stay.
- **Last-active guard**: none of the remaining lists has one (it previously applied only to
  Interview modes and Default interview rounds, both now removed).
- **Pickers show active items only.** Add and Edit forms use the default (active-only) endpoints. In
  an Edit modal an inactive **saved** value still renders as a selected extra option (legacy
  handling) so it is never silently blanked; saving it unchanged passes the backend grandfather
  clause. The live onboarding document suggestion uses active items only.
- **Validation on entities.** On create, an inactive or non-existent list value is rejected; on
  update it is accepted if it is active **or** equals the record's current saved value (grandfather).
  Empty/`null`/missing means "not provided" for optional fields. Shared helpers:
  `isAllowedListId` (IDs) and `isAllowedListValue` (text) in `src/lib/settingsListValidation.ts`.
  Deactivating never rewrites a saved copy — `documents_status` is untouched.
- **Out of scope:** the `interview_rounds` master table, its `is_active` and
  `POST /api/interview-rounds` are unchanged; nothing reads that `is_active`.

### Demand Fulfillment Settings — removed tabs (Default interview rounds, Interview modes, Experience levels)

All three tabs are gone — UI, admin CRUD endpoints and (for Experience levels) the backing table —
per explicit instruction, superseding the "keep but stop reading" state these were left in
immediately beforehand. What stayed, because other things still read it at runtime:

- `GET /api/admin/settings/demand-fulfillment` still returns `interview_rounds_default` and
  `interview_mode_options`, **now read-only** (no PUT path, no per-item toggle route, no settings
  UI). `interview_rounds_default` seeds the "Or select an existing round" global suggestion chips
  in the Demand/Company round configurators (`DemandForm.tsx` / `CompanyForm.tsx` →
  `InterviewRoundConfigurator`'s `globalChips`); `interview_mode_options` is
  `resolveInterviewModes()`'s source for validating an interview's `mode` when scheduling
  (`POST /api/interviews`, `PUT /api/interviews/[id]`). Both values are frozen at whatever
  `super_admin_settings` last held (or `HARDCODED_DEFAULT_INTERVIEW_ROUNDS` /
  `HARDCODED_DEFAULT_INTERVIEW_MODES` if that key is empty, which it is on this branch — a prior
  migration already archived and deleted those two keys) — there is no longer any way to change
  them short of a direct DB write.
- Removed: `InterviewRoundsSection.tsx`, `InterviewModesSection.tsx`, `ExperienceLevelsSection.tsx`;
  their menu entries in `settingsSections.ts`; `useToggleInterviewRoundMutation` /
  `useToggleInterviewModeMutation` and the `toggleInterviewRound` / `toggleInterviewMode` service
  calls; the two per-item toggle routes
  (`/api/admin/settings/demand-fulfillment/interview-rounds/[name]/toggle`,
  `.../interview-modes/[name]/toggle`); `computeGlobalRoundUsage` / `diffRemovedInUseRoundNames`
  (`src/lib/demandFulfillment/interviewConfig.ts`) and the PUT guard that called them;
  `interviewRoundSchema` and the `interview_rounds_default` / `interview_mode_options` fields of
  `superAdminSettingsSchema`; `interview_rounds_usage` / `InterviewRoundUsage` from
  `SuperAdminSettingsDF`.
- Experience levels, specifically: the `experience_levels` table (dropped again — see
  `prisma/migrations/20261017090000_drop_experience_levels_settings`, archived into the same
  `settings_experience_levels_archive` table the earlier removal created), `/api/experience-levels`,
  `/api/admin/settings/experience-levels/*`, `experienceLevels.schema.ts`,
  `useExperienceLevelsQueries.ts` / `useExperienceLevelsMutations.ts`,
  `experienceLevels.service.ts`, `canManageExperienceLevels`, the `ExperienceLevel` type, and the
  `queryKeys.experienceLevels(IncludeInactive)` entries. Nothing in the Demand or Company flow ever
  read this table again after the prior task's removal, so dropping it has zero runtime effect —
  `demands.experience_levels` (the Demand form's own free-text chip field) is unaffected.
- Not touched: `findInUseDemandRoundConflicts` (the per-demand in-use guard for
  `demand_interview_rounds`), `resolveConfiguredRounds` / `resolveInterviewRounds` /
  `resolveInterviewModes` (the demand → company → global-default → hardcoded resolution chain),
  `company_interview_rounds` / its `mode` column, and `CandidateInterviewsSection.tsx`'s own
  interview-mode scheduling UI.

## 4. Data & storage

PostgreSQL. Schema: `prisma/schema.prisma`; migrations in `prisma/migrations/<timestamp>_<name>/migration.sql` (34 migrations, `0_baseline` onward). Model names are **plural snake_case** (`candidates`, `demands`, `profiles`).

Core entities:

| Model | Purpose | Key relations |
|---|---|---|
| `profiles` | Users; `role`, `password_hash`, `status` | parent of most FKs (`created_by`, `updated_by`, assignments) |
| `demands` | Requirements; `request_id` is the human-facing key used in URLs — **not** a relation key: every FK points at `demands.id` | → `companies`, → contact/SPOC profile, → assignments, rounds, status events, submissions, interviews, offers, onboardings; self-relation via `cloned_from_demand_id` |
| `demand_assignments` | Per-demand role assignment (`role_in_demand`: account_manager / spoc / recruiter), `is_active` | demand ↔ profile |
| `demand_ta_allocations` | Recruiter↔demand allocation (visibility scope for `ta`) | unique(demand_id, ta_id) |
| `submissions` | Candidate-in-demand pipeline row; `current_status`, `stage`, `source`, `position_slot`, `is_active` | demand ↔ candidate; unique active (demand, candidate) |
| `submission_events` | Append-only pipeline timeline (status_change, note, call_log, interview_feedback, document_uploaded, bgv_update, remark) with `follow_up_at` | → submission |
| `interviews` | Scheduled interview; `round_id` → `demand_interview_rounds`, date/time as `@db.Date`/`@db.Time` | → submission, demand, candidate |
| `interview_rounds` / `company_interview_rounds` / `demand_interview_rounds` / `demand_interview_config` | Reusable round master + per-company and per-demand configuration | round identity is master; config is per scope |

### Company interview rounds — one canonical store

`src/lib/companies/companyInterviewRounds.ts` is the **only** module that writes `company_interview_rounds`. Read it before touching any round.

Each row is `round_id` (FK to the `interview_rounds` master, identified by name), `order`, an
optional free-text `mode` (e.g. "Video call"), `mandatory`, and `is_active` (default `true`).

| Write path | Call | Rule |
|---|---|---|
| Add Company | `replaceCompanyRounds` inside the create transaction | Optional; company + rounds are written atomically |
| Edit Company (`PUT /api/companies/[id]/interview-rounds`) | `replaceCompanyRounds` | **The only place existing company rounds change.** Reorder, Mandatory and the Active/Inactive toggle are always allowed; renaming, changing the mode of, or deleting a round already in use (see below) throws `CompanyRoundInUseError` → `409 ROUND_IN_USE` |
| Add Demand / Edit Demand | `seedCompanyRoundsIfEmpty` | **First-time seed only** — writes only while the company has zero rounds (active or inactive), re-checked inside the transaction under a `SELECT … FOR UPDATE` on the company row. A demand save never replaces company rounds |

- The frontend does not decide the sync: the form only sends the list; the backend decides whether the company is seeded.
- Rounds are identified by **name** on write (a supplied `round_id` is never trusted as the FK); the master row is reused by normalized name or created.
- `normalizeCompanyRounds` trims names and modes, rejects blank names and case-insensitive duplicates, and re-derives a dense `1..n` order (required by `UNIQUE(company_id, round_order)`).
- **In-use guard** (`computeCompanyRoundUsage`): counts, per round, the distinct demands of THIS
  company whose `demand_interview_rounds` matches it (by `master_round_id`, or by case-insensitive
  name for a legacy row with no master link), plus an orphan-interview fallback
  (`interviews.level` text match when the demand's round row no longer exists). A non-zero count
  blocks a rename, a mode change, or a delete of that round — `replaceCompanyRounds` matches each
  existing in-use round against the incoming list **by `round_id`**; no match, or a different
  name/mode, is what triggers the 409. Reorder / Mandatory / Active-Inactive never trigger it.
  `GET`/`PUT /api/companies/[id]/interview-rounds` return this count per round as `usage` /
  `inUse`, which is what the Clients Master editor's Usage badge and lock icon show.
- Editing a company's rounds changes what **new** demands inherit. Existing demands keep `demand_interview_config` / `demand_interview_rounds` and are never rewritten.
- An **inactive** company round is excluded from what a brand-new demand auto-loads
  (`useDemandInterviewRounds`) and from `resolveConfiguredRounds`'s company tier, but a demand
  that already inherited it keeps its own copy regardless.
- Effective rounds for a demand still resolve demand override → company (active rounds only) → global default → `['Technical','HR']` (`src/lib/demandFulfillment/interviewConfig.ts`).
- One-time backfill for companies that still have no rounds: `prisma/migrations/20261012120000_backfill_company_rounds_from_latest_demand/`. Idempotent — it only fills companies with zero rounds.
- There is no more "global suggestions" picker anywhere: Add Demand, Add Client and Edit Client
  each show only this company's / this demand's own rounds plus an inline "type a new round"
  add-row — the shared `interview_rounds_default` chip source (`SuggestionChips.tsx`) was removed.
  `interview_rounds_default` itself still exists for other reasons — see "Demand Fulfillment
  Settings — removed tabs" above.
- `InterviewRoundConfigurator` (`src/components/interviewRounds/`) is the ONE shared row editor for
  both scopes, switched by a `variant: 'company' | 'demand'` prop: `'company'` additionally shows
  the Usage badge and the Active/Inactive toggle; `'demand'` is the plainer row (drag, #, name,
  mode, Mandatory, edit, delete). Both variants' add-row takes a name AND a mode input; inline edit
  changes both together.

### Company master — SPOC

`companies` carries one optional, company-owned column alongside the contact fields:

| Column | Type | Meaning |
|---|---|---|
| `spoc_id` | `UUID?` → `profiles.id` | The company-level SPOC. Validated to the `spoc` role by `lookupCompanySpoc` (`src/lib/companies/companySpoc.ts`) — the same rule the Demand form applies to `demands.spoc_profile_id`, implemented separately so the Demand write path is untouched. Optional and clearable. |

Nullable, so **a company created before this column keeps loading and saving unchanged** —
`spoc_id` stays NULL. Nothing is back-filled and no migration touches existing rows beyond adding
the column.

- Written by the same Company create/update calls that write the contact fields, inside the
  existing transaction (`toCompanyCreateData` is the single canonical mapping). There is no
  separate endpoint and no demand-side mirror: a demand owns its own SPOC.
- The Add/Edit Company form renders the SPOC with the same `useSpocProfilesQuery` + `UserSelect`
  pair the Demand form uses.
- A company-level "recommended experience levels" list (`companies.experience_levels`) existed
  briefly on this branch and was removed again: Demand's own Experience Level is a free-text chip
  list (see below), not sourced from the company or from any master list.

### Bulk import / export — one shared core

Every bulk flow (Demands, Candidates, Companies) is the same five steps, and four of them are not
entity-specific. `src/lib/bulk/` therefore owns them, and each module keeps only what is its own:

| Concern | Owner |
|---|---|
| Read a workbook (`.xlsx` / `.xls` / `.csv`), row + size ceilings, header→field matching, comma splitting, upload validation | `src/lib/bulk/workbook.ts` |
| Row outcome shape (`created` / `skipped` / `failed`) and the client-side error-report CSV | `src/lib/bulk/importResult.ts` |
| The upload → mapping → preview → result modal | `src/components/bulk/ImportModal.tsx` |
| The toolbar "Export" / "Download Template" dropdown | `src/components/bulk/DownloadMenu.tsx` |
| Field list (columns, aliases, examples, hints) | `src/constants/<module>ImportFields.ts` |
| Row → payload resolution and every business rule | `src/lib/<module>/<module>ImportService.ts` |

A module keeps its own wire shape — Demand still answers `success: boolean` per row — and adapts
it at the component boundary, so nothing existing changed when the shared core landed.
`skipped` exists because a row can be deliberately **not** written (the Company import skips a
company that already exists) which is neither a success nor a failure.

Companies specifically: Company Name is the unique key, matched case- and whitespace-insensitively
(`findByNormalizedName`); an existing company is **skipped, never overwritten**; duplicates inside
one file let the first row win and skip the rest; `SPOC Email` must resolve to a profile with the
`spoc` role (`lookupCompanySpocByEmail` — the form/API path uses `lookupCompanySpocById`, and
neither selector is inferred from the other); email/phone/website go through the same
`companySchema` as the Add Company form; rounds are comma-split and de-duplicated. Each
row is resolved and written independently, so one bad row never blocks the rest.

### Experience levels — Demand "Experience Level" (free text only)

The Demand form's Experience Level field is a **free-text chip list** (`demands.experience_levels`,
`TEXT[]`), entered exactly like "Locations" — `TagInput`, Enter to add, removable badges — and is
**not** sourced from any master list. `normalizeSkillsInput` (`src/lib/skills.ts`, shared with
Required Skills / Candidate Key Skills) trims, drops blanks, caps length and de-duplicates
case-insensitively server-side on every create/update. Bulk import reads/writes it as a
comma-separated column (same convention as Locations / Required Skills).

There is no master list backing it any more. A global `experience_levels` settings table (Demand
Fulfillment Settings → Experience levels) and a company-level "recommended experience levels" list
(`companies.experience_levels`) both existed on this branch at different points and were both
removed — see "Demand Fulfillment Settings — removed tabs" above and the "Company master — SPOC"
section.

### In-use protection — Edit Demand and Edit Company both have one, separately

Two independent in-use guards exist, each scoped to its own table — there is still no cross-check
between them (a round a *company's demand* uses does not block an edit on that *demand's own*
copy, and vice versa).

| | Edit Demand (`findInUseDemandRoundConflicts`) | Edit Company (`computeCompanyRoundUsage`, in `replaceCompanyRounds`) |
|---|---|---|
| In-use check | **Yes** | **Yes** |
| Scope when it applies | Interviews on **this** demand only | This company's own demands (materialized round match) + a candidate-interview fallback |
| Blocks | Delete / rename of a round that has interviews | Delete, rename, or mode change of a round already used by a demand/interview |
| Always allowed | Reorder, Mandatory, add | Reorder, Mandatory, Active/Inactive toggle, add |
| Where enforced | Inside the `PUT /api/demands` transaction | Inside `replaceCompanyRounds`'s transaction (`PUT /api/companies/[id]/interview-rounds`) |
| Error shape | `409` + `code: 'ROUND_IN_USE'`, rounds named | `409` + `code: 'ROUND_IN_USE'` (`CompanyRoundInUseError`), rounds + usage counts named |

Deleting a company round — when allowed — only changes what *new* demands of that company
inherit; demands hold their rounds in `demand_interview_config` / `demand_interview_rounds`, and
interviews reference those materialized rows, never `company_interview_rounds` directly.

How the demand-side guard works:

- **Identity is the materialized row id** (`demand_interview_rounds.id`) — what `interviews.round_id` points at — never the name. A rename is therefore "same row, new name", and a delete-then-re-add under the same name is caught too because the re-added entry carries `row_id: null`.
- The check runs **inside the write transaction**, so an interview created while the form is open is seen by the very save that would orphan it. It throws, rolling the entire edit back, and the route answers `409` + `code: 'ROUND_IN_USE'` with a message naming each blocked round.
- Payloads that omit `row_id` (older clients) fall back to matching on master id, then normalized name — unchanged behaviour for them.
- `GET /api/demands/[requestId]/interview-config` returns `interviews_count` and `in_use` per round so the form can disable delete/rename and explain why. **Hint only** — the save re-checks.
- Pure-rule unit tests: `src/lib/companies/companyInterviewRounds.test.ts`.
| `offers` / `onboardings` | Offer release and BGV/onboarding tracking; `documents_status` JSON | → submission (unique), candidate, demand |
| `candidates` | Candidate master pool; `skills`/`preferred_locations` are Postgres `text[]`; CTC as `Decimal(10,2)` | submitted to many demands |
| `companies` | Clients master (no delete); optional `spoc_id` (company SPOC) | → demands (`ON DELETE RESTRICT`), → profiles via `spoc_id` (`SET NULL`) |
| `notifications` | Per-user inbox; `dedupe_key` gives idempotency | → profile, cascade delete |
| `demand_status_events`, `dropdown_masters`, `super_admin_settings`, `compensation_currencies`, `compensation_types`, `clients`, `client_contacts` | Audit, masters, settings | |
| `skill_categories` / `skills` | Admin-managed Skills library (role category → skills) backing the `SkillsSelector` component (Demand "Required Skills" / Candidate "Key Skills") | Picker source. The **skills** are not a foreign key: `demands.technology_stack` / `candidates.skills` keep their existing plain `text[]` columns, so renaming a skill never changes an already-saved record; no in-use block. The one exception is the `skills_category_id` column on both — see "Role category on a demand / candidate" below |
| `activity_logs` | Referenced by `/api/logs` via raw SQL only; **not in the Prisma schema** (optional table) | |

Visibility/derived data: `src/lib/demands/demandAgingQuery.ts` builds the aging view/base query used by the demand list, dashboard and performance reports (raw SQL; the old `v_demands_with_aging` view was dropped in migration `20261002071044`).

### Role category on a demand / candidate — `skills_category_id`

The Skills library's role category ("Full stack developer") is picked inside a skills field and
is saved with the record as a nullable FK to `skill_categories` (`ON DELETE SET NULL`), so Edit
can preselect it. The same rules apply to **both** owners:

| Owner | Form field | Column | Migration |
|---|---|---|---|
| Demand | Required Skills | `demands.skills_category_id` | `20261019090000_demand_skills_category_id` |
| Candidate | Key Skills | `candidates.skills_category_id` | `20261019091500_candidate_skills_category_id` |

| Concern | Rule |
|---|---|
| Storage | `UUID?` FK — **never** inferred from the skills array (`demands.technology_stack` / `candidates.skills`), which is hand-edited, merged and can be emptied |
| Naming | Unrelated to `demands.role_category`, which is the **Employment Type** enum |
| Create / update | Validated with `isAllowedListId` (`src/lib/settingsListValidation.ts`) against the ACTIVE category ids — active-or-nothing on create, plus the **grandfather clause** on update, so a record whose category was deactivated or deleted still saves |
| Clearing | `null` clears it; an absent key leaves it alone. The skills are never touched |
| Deleted / inactive category | `GET /api/skills-library` returns active categories only, so the dropdown is simply **blank** — an inactive value is never preselected |
| Migration | Column + index + FK, **no backfill**: an existing record keeps `NULL` and a blank dropdown |
| Read path | The demand list needs `DEMANDS_WITH_AGING_BASE` updated (it enumerates columns); the candidate list is a plain `findMany`, so it carries the column for free |
| Clone | `buildDemandCloneForm` resets it, like `request_id` |
| Export / bulk import | No new column in either — imported records simply get `NULL` |

Frontend: `SkillsSelector` takes optional `categoryId`/`onCategoryChange`, passed by both the
Demand and Candidate forms. With neither prop the category stays local UI state.

### "Add Existing Candidate" picker — the whole pool, keyset-paginated

Demand detail > Pipeline's "Add Existing Candidate" is the one place that must search the
**entire** candidate master pool at lakhs scale, so it is a separate opt-in branch
(`GET /api/candidates?requestId=…&picker=all`) rather than a change to the shared
`requestId` behaviour — the Interviews & Schedules candidate field still calls
`?requestId=…` and depends on its skill filter + already-pipelined exclusion.

| Concern | Owner |
|---|---|
| Query (search + keyset + the pipeline flag in one pass) | `src/lib/candidates/candidatePickerQuery.ts` |
| Cursor encode/decode (shared with notifications) | `src/lib/paginationCursor.ts` |
| Route branch + pipeline annotations | `GET /api/candidates` (`picker=all`) |
| Candidate → pipeline source mapping | `src/lib/candidates/candidateSource.ts` |
| List + infinite scroll + source prefill | `src/components/demandFulfillment/AddCandidateModal.tsx` |

- **No skill filter.** Every candidate matching the actor's visibility scope and not archived
  is listed; a candidate whose skills match nothing on the demand is selectable.
- **Pagination is keyset**, not offset: sort `(created_at DESC, id DESC)`, an opaque base64
  cursor over that exact tuple, `LIMIT 21` to answer `hasMore` without a second COUNT. `id` is
  the deterministic tie-break, so concurrent inserts can never skip or duplicate a row. Page
  size is a server constant (20) — a client cannot ask for more.
- **Search is server-side and debounced (~300 ms)**, over name / email / phone / skills,
  case-insensitive partial. It rides in the React Query key, so a new term starts a fresh first
  page, and `useInfiniteQuery` discards an in-flight page whose key changed — that is what stops
  a slow response for an old term from overwriting a newer one.
- **`already_in_pipeline` is an annotation, never a filter.** The row is returned and rendered
  disabled with an "Already in pipeline" badge, instead of being hidden. The write path
  (`POST /api/demands/[requestId]/candidates`) still rejects a duplicate submission.
- **Indexes** (`20261019093000_candidate_picker_indexes`): `pg_trgm` + GIN on
  `full_name` / `email` / `phone`, a GIN on `candidates_skills_text(skills)` (an IMMUTABLE
  wrapper — PostgreSQL refuses to index `array_to_string` directly), and a composite
  `(created_at DESC, id DESC)` for the keyset. Without these a `%term%` ILIKE is a sequential
  scan on every keystroke.
- **Source prefill**: selecting a candidate sets the pipeline entry's Source from that
  candidate's own `source` via `submissionSourceForCandidate` (an explicit map, because the two
  vocabularies differ — e.g. candidate `direct` → pipeline `internal_db`). It stays editable,
  and a candidate with no/unmapped source leaves the current default alone.

### Requirement ID (`demands.request_id`) — manual-entry rules

| Concern | Owner |
|---|---|
| Auto-generation (`CSF-<year>-<NNNN>`, max+1 under an advisory lock, skips any existing ID) | `src/lib/demands/demandRequestId.ts` |
| Manual-entry rules, shared by form + `POST /api/demands` + bulk import | `src/lib/demands/demandRequestIdRules.ts` |
| Inline duplicate hint in the form | `GET /api/demands/request-id-check` + `useDemandRequestIdAvailabilityQuery` |
| Case-insensitive duplicate check | `isDemandRequestIdTaken` (used by create and import) |

Allowed characters `A-Za-z0-9-_`, must start with a letter or digit, 3–30 chars, trimmed and
stored UPPERCASE, unique case-insensitively; the `CSF-YYYY-NNNN` shape is **reserved** for the
generator (`"This format is reserved for auto-generated IDs"`). A blank value is valid and
still auto-generates. **The ID is immutable after creation** — read-only in Edit Demand,
`409 REQUEST_ID_IMMUTABLE` in `PUT /api/demands`, same rule as `COMPANY_CHANGE_NOT_ALLOWED`.
Nothing is migrated: a legacy ID that breaks the rules still loads and saves, because the rules
only judge a value the caller is actually *setting*.

`request_id` is a **human-facing key, never a relation key** — every FK points at `demands.id`.
It is, however, still the URL/lookup key of the fulfillment API (`/api/demands/[requestId]/**`,
`loadDemandContext`, `POST /api/interviews`'s `demand_request_id`, `demandDetailHref`), which is
exactly why it can no longer change.

Conventions worth remembering:
- All PKs are `uuid_generate_v4()` (`@db.Uuid`).
- Timestamps are `@db.Timestamptz(6)`, defaulted `now()`.
- Compensation bounds on `demands` are **free text** (`VarChar(50)`), displayed verbatim.
- `@db.Date` / `@db.Time` columns must be formatted with `formatScheduledDate` / `formatScheduledTime` (UTC-anchored), never `formatDate`.

## 5. Security

| Concern | Implementation |
|---|---|
| Session | HS256 JWT (`SESSION_SECRET`), cookie `session_token`, 7-day expiry, payload `{ userId, email, role }`. `requireAuth` throws `AuthError(401)`, `requireRole` throws `AuthError(403)`; `super_admin` always passes `requireRole`. |
| Route protection | `src/middleware.ts` (UI only). API routes do their own checks. |
| Authorization | Named predicates only — never inline role comparisons in a route. See `docs/ROLES_AND_PERMISSIONS.md` §"Where each rule lives in code". |
| Row-level visibility | `buildDemandVisibilityCondition` / `buildCandidateScopeFilter` injected into list queries; `ta` scoped by `demand_ta_allocations`. |
| Passwords | `bcryptjs` (`src/lib/auth/password.ts`), `password_hash` stripped in `getCurrentUserProfile` and never serialized. |
| Input validation | zod schemas in `<module>.schema.ts`, parsed **inside** routes (shared with forms). |
| Raw SQL | Only `Prisma.sql` tagged templates; identifiers go through allow-listed helpers (`src/lib/auth/rawSqlIdentifier.ts`) and constant field maps (`src/constants/search.ts`, `src/constants/filters.ts`). |
| Notifications | Recipient resolved from session only; foreign id → 404 to avoid leaking existence. |
| UI gating | `RequireRole`, sidebar gates, per-row `can*` calls — UX only, never the boundary. |

## 6. Deployment

- `.github/workflows/deploy.yml` — CI on GitHub Actions (install → `npm run build` → deploy target; **Unverified**: the deploy provider is not visible from the workflow alone without reading it fully).
- Runtime: any Node host able to run `next start`; requires `DATABASE_URL` and `SESSION_SECRET`.
- Prisma: `prisma/schema.prisma` + `prisma7.config.ts` (schema path, migrations path, `DATABASE_URL`, `SHADOW_DATABASE_URL`). Generate the client after any schema change — output lands in `src/generated/prisma`.
- Batch jobs are `tsx` scripts run by an external scheduler: `npm run closure-cron`, `create-super-admin`, `seed:dummy`, `import-excel`.

## 7. Monitoring

- No APM/error-tracking library is wired in (**Unverified** whether the host provides any).
- Observability today: `console.error`/`console.warn` in routes, `activity_logs` table via `/api/logs` (UI: `components/logs/ActivityLogs.tsx`), audit/event tables (`demand_status_events`, `submission_events`, `notifications`, `created_by`/`updated_by` on most tables).
- Recommended minimum for new code: keep `console.error` on caught failures, return structured error bodies, and never swallow an error silently (the `activity_logs` fallback is a deliberate, documented exception).

## 8. Scalability notes

- Prisma `include`/joins are used for most reads; the heavy derived reads (aging, performance, dashboards) use `$queryRaw` — index new filter columns you add to those queries.
- Pagination is offset-based (`page`/`pageSize`, max 100) everywhere except the notification feed, which is **cursor-based** (`src/lib/notifications/cursor.ts`).
- Notifications poll every 45 s for the unread count plus refetch on dropdown open / window focus — by design, not WebSocket.
- Excel import/export is synchronous in the request (hence the 50 MB server-action limit); large files should be chunked if that becomes a problem.
- React Query `staleTime` is typically 30 s with `keepPreviousData` for lists; `refetchOnWindowFocus` is disabled globally.

## 9. Annotated folder tree

```
src/
  app/
    layout.tsx                 Root layout + Providers (Redux, React Query, Toast, Hydration)
    providers.tsx              Client providers composition
    page.tsx                   / -> org-overview redirect
    login|forgot-password|reset-password/   Auth pages (no AppShell)
    not-found.tsx              404
    globals.css                Tailwind layers + CSS variables (slate theme)
    (app)/                     Authenticated route group (no URL prefix)
      layout.tsx               Wraps every authed page in AppShell
      org-overview/            Dashboard
      demands/                 List + [requestId] + tab routes (pipeline/interviews/onboarding/overview/settings)
      candidates/  interviews/  interview-calendar/  offers/  companies/  users/  roles/
      performance/             recruiters | account-managers | client-analytics | global-kpis
      settings/                demand-fulfillment (super_admin)
      org-overview/            KPI + charts
    api/                       ~50 REST handlers, one folder per resource
  components/                  Feature folders; <Module>View + Row + Form + Modals; ui/ = shadcn primitives
  constants/                   Enum value lists, search/filter field maps, import field maps
  features/listState/          Redux slice: per-list search/filters/pagination
  generated/prisma/            GENERATED Prisma client - do not edit, do not import @prisma/client
  hooks/                       useDebounce, useLifecycleDrawer, useDemandInterviewRounds
  lib/                         Cross-cutting logic (auth, db, demandFulfillment, candidates, pagination, search, utils)
  queries/<module>/            use*Query.ts + use*Mutations.ts (React Query wrappers)
  redux/                       Store + typed hooks
  services/                    *.service.ts axios wrappers
  middleware.ts                Cookie-based route guard
prisma/                        schema.prisma + migrations/
scripts/                       Seeding / cron / import / reset utilities
docs/                          This documentation + ROLES_AND_PERMISSIONS.md
.github/workflows/deploy.yml   CI/CD
```

### Client feedback round (Nov 2026) — data notes

Migration `20261112120000_client_feedback_round`.

- **Work mode**: `demands.work_modes text[]` is the source of truth. `work_mode` (VARCHAR 20) is
  kept and always written as `work_modes[0]`, so exports, imports and the aging query keep
  working. Use `resolveWorkModes` / `formatWorkModes` (`demand.schema.ts`).
- **Customer JD file**: `demands.customer_jd_file_url / _name`. Uploaded before the demand is
  saved (`POST /api/uploads/jd` → `public/uploads/jd/<uuid>/`); the API only accepts urls
  under `/uploads/jd/`. The pasted `customer_jd` text is unchanged. `skill_description` is shown
  as "Job Summary" (column name unchanged).
- **Client SPOCs**: `company_spocs` gained `vertical`, `supervisor`, `supervisor_designation`,
  `is_active`. `replaceCompanySpocs` now **updates rows by id** instead of delete + recreate,
  because `demands.client_spoc_ids` stores ids; a removed SPOC still used by a demand is kept as
  inactive. Demands take client SPOCs on create/edit (`client_spoc_ids`, validated to the
  demand's client; new picks must be active) and log them as `client_spoc` assignment events.
- **Demand Type → Skill Groups**: `demand_type_skill_categories` (type id × skill group id).
  `SkillsSelector` takes `suggestedCategoryIds` to narrow its group dropdown, with "Show all".
- **Interview rounds**: Add Demand always submits the on-screen rounds, so a new demand owns a
  copy of the client's rounds from creation on (previously an untouched list was not saved and
  the demand kept inheriting the client live).
- **Onboarding steps**: `onboarding_step_templates` (`company_id` NULL = Default list) and
  `onboarding_steps` (one candidate's copy). `ensureOnboardingSteps` copies the client's active
  list (else the Default) on first read, carrying over received documents from the old
  `documents_status` checklist as Completed steps. The migration seeded the Default list from
  the old onboarding document checklist. Order is guidance only. Mark Joined warns on open steps.
  `documents_status` and its routes are left in place for older data but no longer shown.
- **Change log**: `demand_change_events` (scope `demand` | `candidate`, field / old / new).
  Written inside the same transaction as: `PUT /api/demands` (field diff, `demandChangeSnapshot`),
  `PUT /api/candidates` (logged on every demand the candidate is in), onboarding step updates.
  Assignment changes on create/edit now also write `demand_assignment_events`.
  `GET /api/demands/[requestId]/change-log` merges it with `demand_assignment_events`,
  `demand_status_events` and `submission_events` (newest 500).
- **Demand detail tabs**: `src/app/(app)/demands/[requestId]/[tab]/page.tsx` serves every tab in
  `DEMAND_DETAIL_TABS` without its own folder (Assign, Sourcing, Shortlist, Selection, Closure,
  Change Log). Before it, those tab links answered 404.

### Demand + candidate fields (Nov 2026) — migration `20261113100000_demand_candidate_fields`

- `demands.total_experience`, `relevant_experience` (free text) and `certifications` (JSONB
  `[{ name, type }]`, type in `DEMAND_CERTIFICATION_TYPES`; read with `toDemandCertifications`,
  which drops malformed items). All three are in the change-log snapshot.
- `candidates.offer_in_hand`, `offer_company`, `offer_ctc`, `offer_doj`. Setting Offer in hand to
  No clears the other three. `holding_other_offer` is a legacy column nothing reads.
- Urgency is computed, never stored: `candidateUrgency` (`src/lib/candidates/candidateUrgency.ts`)
  — high when the offer DOJ is within 30 days / passed, or offer + Immediate/15-day notice.
- `candidate_conversations`: append-only Conversation Log, optional `demand_id` (must be one of the
  candidate's demands). Shown in the Candidate 360 drawer and the pipeline candidate panel.

### Task Log + To-Do List (Nov 2026) — migration `20261113120000_task_log_todo`

- `task_logs` (user_id, task_name, details, start_date, end_date NULL = ongoing, remarks) and
  `todo_items` (title, details, priority, active_from/active_until, status open|done,
  is_published + published_at, created_by). Both use `@db.Date` written as UTC midnight
  (`toDbDate` / `fromDbDate` in `src/lib/teamWork/serialize.ts`).
- "Today" for To-Do views is India time (`todayInIndia`), inclusive on both ends of the period.
- Sidebar section "3. TEAM WORK" (all roles); Master Data and Users renumbered to 4 and 5.
- Org Overview shows a Team To-Do card (open items active today).

### Reports (Nov 2026)

- Read-only `$queryRaw` aggregations under `src/app/api/reports/`. No new tables.
- Scope: Client-wise Demands and Today's Interviews use `buildDashboardDemandCondition` (same as
  the dashboard — a Recruiter sees their assigned demands); Ready to Join uses
  `buildCandidateVisibilityCondition` (the candidate read rule).
- Phase buckets come from `LIFECYCLE_PHASE_STATUSES` (the demand tabs), plus "Rejected / Dropped"
  for every other status (`src/lib/reports/reportPhases.ts`). Closed / cancelled demands are
  excluded unless "Include closed" is ticked.
- Ready to Join: Immediate notice or Available From ≤ today (India), not archived, and not placed
  (offer accepted / onboarding / BGV / joined) on any demand. Max 300 candidates per list.
- Sidebar: "4. REPORTS"; Master Data and Users renumbered to 5 and 6. `MasterDataPage` takes `wide`.

### Call Log + Instruction Log (Nov 2026) — migration `20261113140000_call_log_instructions`

- `demand_call_logs` (demand, candidate, outcome fit|not_fit, fail_reason — DB check: required for
  not_fit — notes, submission_id for a fit call, created_by). `demand_instructions` (source,
  instruction_date, content, created_by).
- Adding a candidate to a pipeline has ONE implementation: `attachCandidateToDemand`
  (`src/lib/demandFulfillment/attachCandidateToDemand.ts`), used by Add Candidate and by a Fit
  call (active → 409 / "already in pipeline", rejected → same row reactivated, cap → Backup).
- A call's new candidate is checked with `findDuplicateCandidate` first and reuses the match.
- Fixed: `findDuplicateCandidate`'s phone SQL sent `'D'` instead of `'D'` (JS template escape),
  so duplicate phones were never detected before the DB unique index rejected them.
- Demand tabs: "Instructions" after Assign.

## 10. Key entry points

| I need to… | Open this first |
|---|---|
| Add/modify a page | `src/app/(app)/<module>/page.tsx` then `src/components/<module>/<Module>View.tsx` |
| Add/modify an API endpoint | `src/app/api/<resource>/route.ts` — copy the nearest existing handler's auth/where/pagination shape |
| Change a role's power | `src/lib/auth/demandPermissions.ts`, `demandFulfillmentPermissions.ts`, `candidatePermissions.ts`, `companyPermissions.ts` **and** `docs/ROLES_AND_PERMISSIONS.md` |
| Change the data model | `prisma/schema.prisma` → new migration folder → regenerate client into `src/generated/prisma` |
| Change status/pipeline rules | `src/lib/demandFulfillment/{constants,statusTransitions}.ts` |
| Change interview rounds (company or demand) | `src/lib/companies/companyInterviewRounds.ts` (company) and `findInUseDemandRoundConflicts` in `src/lib/demandFulfillment/interviewConfig.ts` (per-demand in-use guard) — read the two tables above first |
| Change the Skills library (admin) or any skills-picker field | `src/components/demandFulfillment/SkillsLibrarySection.tsx` (admin UI, in Demand Fulfillment Settings), `src/app/api/admin/settings/skill-categories/**` + `src/app/api/admin/settings/skills/**` (CRUD + reorder, `canManageSkillsLibrary`), `src/app/api/skills-library/route.ts` (read, any authenticated role). Use `src/components/ui/SkillsSelector.tsx` for any "pick skills" field — do not add another `TagInput` for skills. |
| Change the Demand Fulfillment Settings page layout/sections | `src/components/demandFulfillment/SuperAdminSettingsView.tsx` (wires the settings GET cache to each section — see below), `SettingsMenu.tsx` + `settingsSections.ts` (left section menu), `SettingsItemRowActions.tsx` (shared pencil / trash / Active-Inactive switch / Inactive badge). Every section saves itself directly via `PUT /api/admin/settings/demand-fulfillment` (partial body) or its own per-entity mutation (Compensation/Skills Library) — there is no shared "Save Settings" form state to add to. |
| Add a shared enum value | `src/lib/demandFulfillment/constants.ts` or the module's `*.schema.ts` |
| Add a UI component | `src/components/ui/` (shadcn pattern) or the feature folder |
| Add a hook | `src/queries/<module>/use<Thing>Query.ts` + register the key in `src/lib/queryKeys.ts` |
| Navigation/sidebar item | `src/lib/navigation/routes.ts` (single source for sidebar, title, active state) |
| Master Data (clients, end clients, skill groups, skills, demand category/phase/location/type, interview status, onboarding documents) | `src/lib/navigation/routes.ts` section "MASTER DATA MANAGEMENT"; named lists under `src/app/api/master-data/[kind]`; end clients under `src/app/api/end-clients`; client SPOCs on `companies` via `company_spocs` |
| Demand detail tabs | `src/lib/demandFulfillment/routes.ts` |
| Change auth/session | `src/lib/auth/{jwt,session}.ts` + `src/middleware.ts` |