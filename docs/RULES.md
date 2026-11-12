# RULES.md — working in Costaff ATS

**Read this before writing any code.** Mandatory, not advisory. If a rule blocks the task, stop and ask instead of working around it.

## 1. Libraries — use the one already installed

| Concern | Library | Rule |
|---|---|---|
| HTTP calls | `axios` via `api` (`src/lib/axios.ts`) | Only inside `src/services/*.service.ts`. Never in a component. Never a raw `fetch` to our own API. |
| Server state / caching | TanStack Query (`useQuery`/`useMutation`) | Every data read goes through `src/queries/**`. Keys must come from `src/lib/queryKeys.ts` (add a key there; don't inline array literals). |
| Cross-route UI state | Redux Toolkit — **only** the `listState` slice | Do not add new slices. Active page/tab is URL state, not Redux. |
| Forms + validation | `react-hook-form` + `@hookform/resolvers` + `zod` | Schema lives in `components/<module>/<name>.schema.ts`, next to the form. **The same schema is imported by the API route** — extend it there rather than validating ad hoc. |
| UI primitives | shadcn/ui in `src/components/ui/` | Reuse `button`, `dialog`, `select`, `popover`, `badge`, `input`, `textarea`, `Modal`, `Toast`, `Pagination`, `FormField`, `ErrorDialog`, `TableSkeleton`… before writing a new one. |
| Styling | Tailwind CSS 3.4 + CSS variables (`globals.css`) + `cn()` from `src/lib/utils.ts` | No inline `style={{}}` for layout, no new CSS files, no new UI framework. |
| Icons | `lucide-react` | |
| Tables/charts | Plain elements + `src/components/ui/Pagination.tsx`; charts via `chart.js`/`react-chartjs-2` registered in `components/charts/chartRegistration.ts` | Register new chart types/plugins there, not per component. |
| Dates | `formatDate` / `formatDateTime` / `formatScheduledDate` / `formatScheduledTime` / `formatDurationMinutes` from `src/lib/utils.ts` | `@db.Date`/`@db.Time` columns → the `Scheduled*` (UTC-anchored) variants. Project format is `DD-MM-YYYY`, time `HH:MM`. |
| Money/ranges | `formatCompensationRange` (free text, verbatim) | `formatCompensation` is `@deprecated` — do not use or reintroduce number parsing for demand compensation. |
| Excel | `exceljs` in routes/services | |
| Email | `nodemailer` wrappers in `src/lib/email.ts` | |
| DB access | Prisma client from `src/lib/db/prisma` — import from `@/generated/prisma/client` | **Never import from `@prisma/client`.** |
| Tests | `vitest` (`*.test.ts`, node env) | |

**Do not add a new dependency** without asking first (see §6).

## 2. DO / DON'T

### Structure
- **DO** follow the vertical-slice layout for a feature: `app/(app)/<module>/page.tsx` (thin container) → `components/<module>/<Module>View.tsx` (presentational) → rows/forms/modals in the same folder → `services/<module>.service.ts` → `queries/<module>/use*` → `app/api/<resource>/route.ts`.
- **DO** add the zod schema to `<module>.schema.ts` and import it in both the form and the route.
- **DO** keep logic out of `page.tsx` containers beyond wiring (handlers + prop passing).
- **DON'T** call a service from an API route, or Prisma from a component.
- **DON'T** add a second source of truth for routes/tabs/statuses: extend `src/lib/navigation/routes.ts`, `src/lib/demandFulfillment/routes.ts`, `src/lib/demandFulfillment/constants.ts`, or the module schema.
- **DON'T** duplicate a form modal — compose the existing `*FormModal` + `*Form`.
- **DON'T** edit anything under `src/generated/prisma/`.
- **DON'T** invent new pages under a route that isn't in `NAV_SECTIONS` without also wiring the nav.
- **DO** make every Demand Fulfillment Settings section save itself directly through the API on each user action (add/rename/delete/reorder/a Mandatory-or-Required toggle immediately; text edits and the Resume Cap number on blur/Enter) — there is no page-level "Save Settings" button, dirty-state tracking or leave-page confirmation. `PUT /api/admin/settings/demand-fulfillment` takes a **partial** body (`SuperAdminSettingsPatch`, one field per call); validate (trim, non-empty, case-insensitive duplicate) before calling it and show an inline error without calling it on failure. Switching the visible section is still a CSS show/hide (`SettingsPanel`), never an unmount — each section now reads its slice of `useSuperAdminSettingsDFQuery()`'s cache directly rather than a lifted form state, so nothing is lost either way. Compensation Currency/Type and Skills Library already worked this way before this page existed, via their own per-entity mutations.

### Naming
- Files: `PascalCase.tsx` for components, `camelCase.ts` for lib/services/hooks, `<module>.schema.ts` for schemas, `<module>.service.ts` for services, `use<Thing>Query.ts` / `use<Thing>Mutation(s).ts` for query hooks.
- Imports: always `@/...` (alias `@/* -> ./src/*`).
- DB enum-ish values are lowercase snake_case strings in Prisma and uppercase-camel in domain constants (`'submitted_to_spoc'`, `'bgv_pending'`); do not introduce TS enums for these — the codebase uses `as const` arrays + types.
- Prisma models are plural snake_case (`demands`, `candidates`); the client property is also plural — `prisma.demands.findMany(...)`.

### Styling
- **DO** use `cn()` for conditional classes, existing CSS variables (`--card-border`, `--card-shadow`, etc.) and the existing spacing/radius tokens.
- **DON'T** add a new color literal where a design token exists; don't add a second button/badge/dialog variant.

### Reuse
- **DO** reuse `Pagination`, `TableSkeleton`, `TableLoadingOverlay`, `Loader`, `SearchInput`, `FilterSelect`, `FormSelect`, `EntitySelect`, `UserSelect`, `TagInput`, `MoreLessText`, `InlineDeleteConfirm`, `ErrorDialog`, `Toast`, `ActivityLogTable`.
- **DO** use `SkillsSelector` (`src/components/ui/SkillsSelector.tsx`) for any "pick skills" field (Demand "Required Skills", Candidate "Key Skills") instead of a plain `TagInput` — it is backed by the admin-managed Skills library (`GET /api/skills-library`) but keeps writing the field's existing plain `string[]` storage format (`value`/`onChange`, same shape as `TagInput`). Manage the library itself (categories + skills) via `SkillsLibrarySection` in Demand Fulfillment Settings, gated by `canManageSkillsLibrary` (`demandFulfillmentPermissions.ts`).
- **DO** reuse `parsePagination`/`buildPaginationMeta` (`src/lib/pagination.ts`), `buildSearchWhere`/`buildRawIlikeWhere`/`buildRawSkillOverlapWhere` (`src/lib/search.ts`), `buildExactMatchWhere`/`buildRawExactMatchWhere` (`src/lib/filter.ts`).
- **DON'T** hand-roll pagination math or `ILIKE` strings in a route.

## 3. Permissions (hard rule)

- **Never** write an inline role check (`if (user.role === 'x')`) in an API route. Call a named predicate from `src/lib/auth/*`:
  - demands CRUD/assignment: `demandPermissions.ts` (`canCreateDemand`, `canEditDemand`, `canDeleteDemand`, `canAssignDemandTo`, `canViewDemand`)
  - pipeline/interviews/onboarding/config: `demandFulfillmentPermissions.ts` (`canManageDemandPipeline`, `canChangeDemandStatus`, `canManageDemandAssignments`, `canManageInterviewConfig`, `canManageSuperAdminSettings`)
  - candidates: `candidatePermissions.ts`; companies: `companyPermissions.ts`; interviews: `interviewPermissions.ts`; notifications: `src/lib/notifications/permissions.ts`
  - row-level list scoping: `src/lib/auth/demandVisibility.ts` (`buildDemandVisibilityCondition`), `buildCandidateScopeFilter`
- Frontend gates (`RequireRole`, sidebar gates, `can*` in the view) are **UX only**. Every write route re-checks server-side.
- A new action on an entity needs **both** a named predicate and a server-side check in the performing route.
- If a permission rule genuinely changes, update `docs/ROLES_AND_PERMISSIONS.md` in the same change (it is the canonical spec).
- `profiles.role` values: `super_admin`, `account_manager`, `spoc`, `hr`, `ta` (= Recruiter), `viewer`.

## 4. Error handling

### API routes
- Wrap the handler body in `try/catch`. On catch:
  - `AuthError` → rethrow/return its `status` with `{ error: message }`.
  - Known/validation errors → `NextResponse.json({ error, ...extra }, { status })` — `400` validation, `401` unauthenticated, `403` forbidden, `404` not found or not visible, `409` conflict (duplicate candidate), `500` unexpected.
  - Unexpected → `console.error('...', err)` + `500` with a generic message (never leak stack traces or SQL).
- Never return a partial success silently: bulk endpoints return per-item results (`{ success, successCount, failureCount, results: [{ id, success, error }] }`).
- Never fabricate data to fill a gap — return `null` and let the UI render blank (`src/app/api/performance/route.ts` is the reference).
- Standard list response shape: entity array under a named key + `total`, `page`, `pageSize`, `totalPages` (via `buildPaginationMeta`). Services unwrap this into `PaginatedResult<T>`.

### Frontend
- Mutations get `onSuccess` (invalidate the affected `queryKeys.*` — plus `queryKeys.dashboard` when a KPI can change) and `onError`:
  `console.error('Error <verb>ing <thing>:', err); toast.error('<Verb> Failed', err?.response?.data?.error || err?.message || 'Failed to ...')`.
- No `alert()`. No silent catch. Loading states use the shared skeleton/overlay components; empty states render an explicit message.

### Raw SQL
- Only `Prisma.sql` tagged templates with bound params. Identifiers must come from constant maps (`src/constants/search.ts`, `src/constants/filters.ts`) or be passed through the allow-listed helpers in `src/lib/auth/rawSqlIdentifier.ts`. **Never** interpolate user input into `Prisma.raw()`.

## 5. Domain rules that are easy to break

- Demand status machine: `src/lib/demandFulfillment/statusTransitions.ts` + `DEMAND_STATUS_REQUIRES_REMARK` (`On Hold`, `Cancelled` need a remark). Never accept an arbitrary status string.
- Submission pipeline: `SUBMISSION_STATUS_VALUES` / `SUBMISSION_FORWARD_ORDER` / `SUBMISSION_TERMINAL_EXIT_STATUSES`. Backward moves require a remark. Every accepted move must write a `submission_events` row.
- Assignment notifications: only **newly assigned** users are notified; re-saving unchanged assignments, retries and removals produce none. The dedupe key format is documented in `docs/ROLES_AND_PERMISSIONS.md`.
- Effective interview rounds precedence: demand override → company → global default → `['Technical','HR']` (`src/lib/demandFulfillment/interviewConfig.ts`).
- **Interview rounds are guarded in exactly ONE place — Edit Demand:**
  - A round that already has interviews on *this* demand can be neither deleted nor renamed. Reorder and Mandatory are always allowed. Enforced by `findInUseDemandRoundConflicts`, called **inside the `PUT /api/demands` transaction** so an interview created while the form is open cannot be orphaned; the throw rolls the whole save back and the route answers `409` with `code: 'ROUND_IN_USE'` and the round named in `error`.
  - **Edit Company has NO in-use check.** Clients Master owns the company's configuration, so delete / rename / add / reorder / Mandatory / clear are always allowed there — even for a round one of the company's demands uses. That demand keeps its own rounds either way (they live in `demand_interview_config` / `demand_interview_rounds`, and interviews reference those rows, never `company_interview_rounds`). Do not reintroduce a company-level guard: it blocks the user from fixing their own master data for no data-integrity gain.
- Demand rounds are matched by **stable id** (`demand_interview_rounds.id`), never by name. The Edit Demand form sends that id as `row_id`; `row_id: null` means "new round", which is how delete-then-re-add under the same name is still caught. A payload that omits `row_id` entirely is treated as an older client and matched leniently on master id / name.
- `interviews_count` / `in_use` on `GET /api/demands/[requestId]/interview-config` are a **UI hint only**; the save re-checks. Never treat them as the boundary.
- Candidates: duplicate email/phone → `409` + `isDuplicate: true`. Recruiters must pass `requestId` when creating a candidate.
- Compensation on `demands` is free text — store and display verbatim.
- Company master has **no delete**; a company referenced by a demand can't be removed; only ACTIVE companies are selectable when creating a demand.
- Notification recipient always comes from the session, never a request param; a foreign id returns `404`, not `403`.
- An OPTIONAL select/enum field (e.g. Candidate Work Mode) needs a real, selectable empty option in the UI (`FormSelect`'s `allowClear`) — never a bare blank trigger with no way to clear it — and the backend must treat `''`, `null` and a missing key as "not provided" (normalize to `null`/ignore) rather than validating them against the enum's real values; see `optionalEnumField` in `candidate.schema.ts`.
- **Admin-managed select options come from Demand Fulfillment Settings, never from a hardcoded list in the form.** The Demand form's "Experience Level" options are the `experience_levels` rows (`GET /api/experience-levels`, managed via the "Experience levels" settings tab, gated by `canManageExperienceLevels`). Rules that go with it:
  - The stored column stays **plain text** (`demands.experience_level`), never an FK. Renaming or deleting an option must not touch saved records and must not be blocked as "in use".
  - Because the column predates the dropdown, a form must still render a saved value that is missing from the list as an **extra pre-selected option** (see `ExperienceLevelSelect`) — silently blanking it on save would lose data.
  - Backend validation is the shared `isValidExperienceLevel` (`src/lib/experienceLevels.ts`), used by both `POST` and `PUT /api/demands`: empty = not provided; otherwise the value must exist in the list **or** equal the record's current stored value. Never auto-migrate or rewrite existing rows to match the list.
  - Optional select ⇒ real selectable empty option (`FormSelect`'s `allowClear`); required select ⇒ every value must match an option.

- **Demand writes that change a field, an assignment or a candidate must leave a trace in the
  Change Log**, in the same transaction: field diffs via `recordDemandChanges` +
  `demandChangeSnapshot` / `candidateChangeSnapshot` (`src/lib/demands/demandChangeLog.ts`),
  assignments via `assignmentEventRows` into `demand_assignment_events`. Do not add a second log.
- **Client SPOC rows are updated by id, never recreated** — `demands.client_spoc_ids` points at them.
- **Every Demand Fulfillment Settings list follows one item lifecycle** — Edit (rename), Delete and Active/Inactive, rendered by the shared `SettingsItemRowActions` (`src/components/interviewRounds/SettingsItemRowActions.tsx`). Never hand-roll a second pencil/trash/switch row or a red text "Delete" button; reuse the component so sizing, spacing, colors, disabled style and tooltip match.
  - **Never delete or rename an in-use item.** An item referenced by real records (demands, companies, interviews, candidates, onboardings) has Edit and Delete disabled with a tooltip that names only its non-zero usage kinds. Mandatory/Required toggles, drag reorder and the Active/Inactive switch stay enabled. The server enforces this inside the write transaction with the existing `409` format; the frontend 409 handling is a race fallback that toasts and refreshes usage counts.
  - **Inactive rows stay listed**, muted with an "Inactive" badge. Left menu count badges count ACTIVE items only. Usage counts and menu counts refresh after every action and when the tab opens.
  - **The last-active guard applies only to Interview modes and Default interview rounds.** Everywhere else, deactivating the last active item is allowed.
  - **New settings lists must follow this lifecycle** — add `isActive` (a real `is_active` column, or an `isActive` key per item for a JSON list read as active when absent), support `?includeInactive=true` behind the same permission as edit, return per-item usage counts, and expose a toggle endpoint gated like edit.
  - **List endpoints return ACTIVE items by default.** `?includeInactive=true` is the only way to see inactive rows and is permission-gated; the settings view uses a **separate query key** from the form pickers. Form pickers and Add flows show active items only; an Edit modal still renders an inactive **saved** value as a selected extra option so it is never silently blanked.
  - **Entity validation follows the grandfather rule** (`isAllowedListId` / `isAllowedListValue` in `src/lib/settingsListValidation.ts`): on create an inactive or unknown value is rejected; on update it is accepted when active **or** equal to the record's current saved value; empty/`null`/missing means "not provided". Deactivating never rewrites a saved copy.
  - **Master Data name lists** (demand category, phase, location, demand type, interview status, skill classification) follow that same lifecycle via `src/lib/masters/namedMasters.ts` and `GET/POST /api/master-data/[kind]`. Demand category, demand type and locations are stored on the demand as text (not FKs). Interview statuses are stored as text on `interviews.status`. `Scheduled` is creation-only (`is_transition = false`); `Completed` requires a result (`requires_result`).

## 6. Constraints

- **Do not add, remove or upgrade a dependency** without asking. Same for editing `package.json`, `tsconfig.json`, `tailwind.config.js`, `next.config.js`, `prisma7.config.ts`.
- **Do not refactor code unrelated to the task.** Keep diffs small and reviewable.
- **Do not modify** `src/generated/prisma/**`, `prisma/migrations/**` (existing ones), `.env`, `package-lock.json`, or `docs/ROLES_AND_PERMISSIONS.md` rules (you may *append* clarifications when a rule genuinely changes).
- Schema changes require: edit `prisma/schema.prisma` → add a new timestamped migration folder → regenerate the client → run `npm run build` and `npm test`.
- Preserve backwards compatibility of existing endpoints (e.g. `/api/performance`'s response shape, `notification` query-key shape for the default empty search).
- Keep comments that explain *why* something is unusual. This codebase documents non-obvious decisions inline; do not strip them.
- Match the existing doc-comment style: a short `/** ... */` explaining the rule or the trap, not a restatement of the code.

## 7. Conventions cheat-sheet

- `'use client'` at the top of pages/views/mutations hooks; API routes and `src/lib/db`, `src/lib/auth/{jwt,session,getCurrentUserProfile}` are server-only.
- Prisma enums-as-strings, so filters use `buildExactMatchWhere` + `buildSearchWhere` rather than literal objects.
- Mutating writes that touch a pipeline/status/assignment also create an event or notification row **in the same transaction**.
- Dates returned by the API are ISO strings; service functions convert numeric fields (e.g. `toNumberOrNull` for `Decimal`) before serializing.
- Formatting/display logic belongs in `src/lib/utils.ts` or a module lib, not inline in JSX.
- Files are `PascalCase` for components including modals (`CandidateFormModal.tsx`); folder names are camelCase feature names.

## 8. Before you finish

1. `npx tsc --noEmit` (or `npm run build`) — must be clean. *(Note: some existing files contain stray `console.log`; do not add new ones.)*
2. `npm test` — Vitest must pass.
3. `npm run lint`.
4. Manual check of the touched flow: log in with a role that can reach it, exercise create/edit/delete + the permission-denied case, and confirm list filters/pagination and cache invalidation behave.
5. Verify no secret/env values and no absolute paths leaked into code or comments.
6. If the change altered structure, features, routes, libraries, permissions or env vars, make the matching small edit to `docs/PRD.md` / `docs/ARCHITECTURE.md` / `docs/RULES.md` / `docs/ROLES_AND_PERMISSIONS.md`.