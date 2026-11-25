# PRD — Costaff ATS (costaff-ats)

> Reverse-engineered from the codebase (Next.js 15 App Router + Prisma/PostgreSQL).
> Source of truth for *what* the product does. `docs/ARCHITECTURE.md` covers *how*,
> `docs/RULES.md` covers *how to work in it*.
> **Canonical permission spec:** `docs/ROLES_AND_PERMISSIONS.md` — when in doubt, it wins.

## 1. Product overview & problem statement

Costaff ATS is an internal, single-tenant **Applicant Tracking System for a staffing /
recruitment company**. It replaces the company's spreadsheet tracker
(`Costaff_Master Tracker_V.1.xlsx`, 9 sheets) with a live, role-aware web application.

**Problem:** demand tracking, candidate sourcing, interviews, offers/BGV and performance
reporting were spread across a multi-hundred-MB workbook. It was not real-time, had no
auditable state history, no per-user visibility rules, and every metric had to be recomputed
by hand.

**Solution:** a database-backed web app where every list, KPI and chart reads live data, every
status change is recorded as an event row, and every action is filtered by the six internal roles.

## 2. Target users (internal staff roles)

DB value on `profiles.role`. Canonical definitions: `docs/ROLES_AND_PERMISSIONS.md`.

| DB value | Who | Core job in the product |
|---|---|---|
| `super_admin` | Delivery head / admin | Full control: users, roles, settings, all data |
| `account_manager` (AM) | Account manager | Owns demands end-to-end, assigns SPOC + recruiters, manages pipeline |
| `spoc` | Client single point of contact | Reviews/shortlists the candidate pipeline of demands they are contact for; read-only on the demand record |
| `ta` | Talent Acquisition / Recruiter | Sources candidates, works the pipeline of demands they are allocated to; no demand-level CRUD |
| `hr` | HR ops | Read-only on demands; CRUD on offers / onboarding / BGV at candidate level |
| `viewer` | Read-only stakeholder | Views everything, changes nothing |

## 3. Goals

- 100% live data — no mocked KPIs, no hardcoded report numbers (a metric the DB cannot support is returned as `null`, never invented — see the comment header in `src/app/api/performance/route.ts`).
- One authoritative state machine for demand lifecycle and candidate-in-demand pipeline, with an event/audit trail.
- Enforced, reusable RBAC predicates shared by API (boundary) and UI (UX gate).
- Row-level visibility: recruiters see only their allocated demands; AMs see/own only their demands (with read-all roles).
- Master data for companies, interview rounds, compensation currencies/types and dropdown options, configurable by Super Admin.

## 4. Core features (as implemented)

| # | Feature | Primary code |
|---|---|---|
| F1 | Auth: email+password login, JWT session cookie, forgot/reset password, logout | `src/app/api/auth/**`, `src/lib/auth/jwt.ts`, `src/middleware.ts` |
| F2 | Org Overview dashboard: KPI cards, today activity, conversion funnel, source charts, aging/red-flag table | `src/components/dashboard/*`, `src/components/charts/*`, `src/app/api/dashboard` |
| F3 | Demands (Requirements): list/search/filter/paginate, create, edit, delete, bulk status change, bulk delete, clone, Excel import/export | `src/app/api/demands/**`, `src/components/demands/*` |
| F4 | Demand detail drill-down: Overview card + Pipeline / Interviews / Onboarding tabs, lifecycle drawer | `src/app/(app)/demands/[requestId]/*`, `src/components/demandFulfillment/*` |
| F5 | Demand assignment: one AM/SPOC contact slot, many recruiters (TA allocations), reassignment | `src/app/api/demands/[requestId]/assign`, `demand_assignments`, `demand_ta_allocations` |
| F6 | Candidate master pool: CRUD, duplicate detection (email/phone), bulk import (Excel) / export, per-candidate history + demand history | `src/app/api/candidates/**`, `src/lib/candidates/*` |
| F7 | Candidate pipeline per demand: kanban of submissions, status transitions, remarks/timeline events, call logs with follow-up dates | `src/app/api/demands/[requestId]/candidates/**`, `src/components/demandFulfillment/PipelineKanbanBoard.tsx` |
| F8 | Interviews: schedule per demand round, list/bulk-status/bulk-delete, global interview calendar (FullCalendar), per-company & per-demand round config | `src/app/api/interviews/**`, `src/app/api/calendar/interviews`, `src/components/demandFulfillment/FullCalendarInterviewView.tsx` |
| F9 | Offers & Onboarding/BGV at candidate level (incl. document checklist, closure due date) | `src/app/api/offers`, `src/app/api/onboarding(s)`, `src/components/offers/*` |
| F10 | Clients (Company) master: create/edit/search + per-company interview-round configuration — the single source of truth for company rounds | `src/app/api/companies/**`, `src/components/companies/*`, `src/lib/companies/companyInterviewRounds.ts` |
| F11 | Users & roles administration | `src/app/api/users/**`, `src/components/users/*` |
| F12 | Notifications: per-user inbox, bell badge (polling), assignment-triggered notifications with dedupe | `src/app/api/notifications/**`, `src/lib/notifications/*`, `src/components/notifications/NotificationBell.tsx` |
| F13 | Performance & analytics report pages (recruiters, AMs, client analytics, global KPIs) | `src/app/(app)/performance/*`, `src/app/api/performance` |
| F14 | Settings: SMTP test, SLA rules, clients master, dropdown masters, compensation currencies/types, super-admin demand-fulfillment config | `src/app/(app)/settings/*`, `src/app/api/settings`, `src/app/api/admin/settings/**` |
| F15 | Activity log | `src/app/api/logs`, `src/components/logs/ActivityLogs.tsx` |
| F16 | Automated demand closure (aging/SLA cron logic, shared with `scripts/closureCron.ts`) | `src/lib/demandFulfillment/closureCron.ts` |
| F18 | Client feedback round (Nov 2026): demand form "Job Summary" + Customer JD file attachment; multi-select Work Mode (`demands.work_modes`); client SPOC Vertical / Supervisor / Supervisor Designation / Active; "Select SPOC" + "Add SPOC" on Add/Edit Demand; Demand Type → Skill Groups narrowing; Recruiters see all demands ("My demands" by default) and can upload profiles to any; Interview Rounds at the bottom of the demand form, copied from the client once at creation; ordered per-client onboarding steps (name, details, file, status) replacing the flat document checklist; per-demand Change Log tab. On hold: Experience Level bands master, Hourly Rate → CTC calculator. | `src/components/demands/*`, `src/app/api/companies/[id]/spocs`, `src/app/api/demand-type-skill-groups`, `src/lib/onboarding/*`, `src/app/api/onboarding-step-templates`, `src/app/api/onboarding/[id]/steps/**`, `src/lib/demands/demandChangeLog.ts`, `src/app/api/demands/[requestId]/change-log` |
| F19 | Demand Total / Relevant Experience and Certifications (name + Technical/Behavioral/Others); candidate Offer in Hand (company, CTC, date of joining) with an "Urgent" / "Offer in hand" badge from the offer DOJ and notice period (`candidateUrgency`); candidate Conversation Log (call / WhatsApp / email / meeting, append-only). Notice Period is the existing `availability` field. | `src/components/demands/CertificationsEditor.tsx`, `src/lib/candidates/candidateUrgency.ts`, `src/components/candidates/CandidateConversationLog.tsx`, `src/app/api/candidates/[candidateId]/conversations` |
| F20 | Team Work: **Task Log** (everyone logs own tasks — name, details, start/end date, remarks; Delivery Head sees everyone's, filter by person/date) and **To-Do List** (AM / SPOC / Delivery Head publish priority items for an active period; everyone sees what is active today; drafts private; Team To-Do card on Org Overview). | `src/app/(app)/task-log`, `src/app/(app)/todo`, `src/components/teamWork/*`, `src/app/api/task-logs/**`, `src/app/api/todos/**`, `src/lib/auth/teamWorkPermissions.ts` |
| F21 | Reports (sidebar "4. REPORTS", all roles, scoped server-side): **Client-wise Demands** (candidates per phase, count + %, drill client → demand → demand tab), **Today's Interviews** (current status, date picker, drill by status, view only), **Ready to Join** (by skill group → location → candidate list; definition in `src/lib/reports/readyToJoin.ts`). | `src/app/(app)/reports/**`, `src/components/reports/*`, `src/app/api/reports/**`, `src/lib/reports/*` |
| F22 | **Call Log** on the Sourcing tab (log a call about an existing or new candidate; Fit → added to Sourcing with the normal add rules, Not fit → Fitment Fail Reason, profile kept in the candidate database; per-caller call / fit / not-fit counts) and **Instruction Log** tab (customer instructions by the demand's AM / SPOC / Delivery Head, read by everyone on the demand). | `src/components/demandFulfillment/{CallLogPanel,LogCallModal,DemandInstructionsPanel}.tsx`, `src/app/api/demands/[requestId]/{call-logs,instructions}`, `src/lib/demandFulfillment/attachCandidateToDemand.ts` |
| F23 | App review batch 1 (Nov 2026): Client "Interview Rounds" → "Interview Template"; "Customer JD" → "Client JD"; "All details" section removed from the demand page; "+ Add Client" removed from the demand form; demand Shift Timings + Comments; Delivery Head sets the Account Manager on the Assign tab; candidate Current / Preferred Location from the Locations master and "Key Skills" → "Skill Group"; Task Log Assigned by + Hours; demand aging (avg / oldest days open, count over 30 days) on the Client-wise Demands report. | `prisma/migrations/20261118100000_review_batch1_fields`, `DemandLifecyclePanels.tsx` (AssignPanel), `CandidateForm.tsx`, `src/components/teamWork/*`, `src/app/api/reports/client-phases` |
| F24 | App review batches 2–5 (Nov 2026). **Candidate**: DOB, alternate email, relevant experience, PAN (encrypted; last 4 shown, full PAN only to editors), passport photo, resume, RTR tick + note + file, employee ID, core specialization, duration in role, reason for change, LWD, Other Details; labels "Full Name (as per Aadhaar / PAN)", "Mobile Number", "Alternate Contact Number"; notice periods Immediate / 0-15 / 30 / 60 / 90 / >90 days / On break; sources HeadHunt, Database. **Other Details** on demand and client too. **Call Log** tab before Sourcing: Skill Group, "Demand Match" (was Fit) opens the pre-filled candidate form and lists the candidate in Sourcing once saved, details popup, edit any time. **Sourcing review**: Save → Submit → AM/SPOC Approve (→ Shortlist) / Reject (reason; back to the recruiter to fix and re-submit); Backup profiles "Submit as Active"; bell notifications both ways. **Draft demands**: "Save as draft" (creator + Delivery Head only, not in dashboards/reports, no assignment notifications) and "Submit to team". **Skill Categories**: skills listed by category; Skill Group editor adds skills by category. **Candidate aging** per phase on pipeline rows + Candidate Aging report. **Team Contribution** report (per person, date range, drill-down per demand). Interview-log comments stamped "[date time · name]"; candidate conversations show in the demand Change Log. Not done (client to confirm): demand field re-order, Save/Submit for phases other than Sourcing. | `prisma/migrations/20261118120000_*`, `20261118140000_*`, `20261118160000_*`, `src/lib/candidates/{panCrypto,phaseAging,candidateProfileFields}.ts`, `src/app/api/demands/[requestId]/candidates/[dcId]/review`, `src/app/api/demands/[requestId]/call-logs/**`, `src/app/api/reports/{contribution,candidate-aging}` |
| F25 | Review of 18 Nov 2026, last three items. **Skill Group → Skill Category → Skills**: Master Data → Skill Group Management lists Skill Groups (add / rename / deactivate / delete) and the Skill Categories (each put into a group) with their skills; on demand and candidate forms a Skill Group picker narrows the Skill Category list (the category is what is saved). The Technical / Domain tag on a skill is now called "Classification". **Status buttons row** (Move to…, Hold, Cancel, Close, Clone) moved from the top of the demand page to the Closure tab. **Smart Reports (AI)**: ask a question in plain English; Claude answers from a scoped, PII-free snapshot of the viewer's demands, pipeline, interviews, aging and (Delivery Head only) team activity. Needs `ANTHROPIC_API_KEY`. | `src/app/api/{skill-groups,admin/settings/skill-groups}`, `SkillGroupsSection.tsx`, `SkillsSelector.tsx`, `src/app/api/reports/smart`, `src/lib/reports/smartReportData.ts` |
| F17 | Master Data Management: Client (with SPOC list), End Client, Skill Group, Skills (Mandatory/Optional + classification), Demand Category, Demand Phase, Locations, Demand Type, Interview Status, Onboarding Document List. Demand create/edit reads client, end client, skill group, skills, demand category, locations and demand type from these masters. Interview status dropdowns read the interview-status master. Demand phase is master data only — tabs are not generated from it. | `src/lib/navigation/routes.ts`, `src/app/(app)/master-data/**`, `src/app/api/master-data/**`, `src/app/api/end-clients/**` |

## 5. MVP scope

The product as committed. Anything not in §4 is out.

Included MVP: F1–F13 (auth, dashboard, demands + drill-down + assignment, candidate pool & pipeline, interviews + calendar, offers/onboarding, company master, users/roles, notifications, performance reports).
Deferred-but-built: F14, F15, F16 (settings config, activity log, closure automation) — present in code, not part of the core MVP loop.

## 6. User stories

- As an **AM**, I can create a demand, assign a SPOC and recruiters, and see candidates flow through the pipeline so I can close it on time.
- As a **recruiter (ta)**, I only see demands I am allocated to, so my list is not cluttered with other people's requirements.
- As a **recruiter**, I can source a candidate against a demand and move them through `sourced → ... → joined`, adding notes and call logs along the way.
- As a **SPOC**, I can review and shortlist candidates on my demands without being able to change the demand itself.
- As a **Super Admin**, I can see org-wide KPIs, manage users and roles, and configure global defaults (rounds, modes, resume cap, document checklists).
- As an **HR** user, I can record offers and BGV status for candidates.
- As a **viewer**, I can look but not touch anything.
- As an **assignee**, I get a notification when I am newly added to a demand — and I am not spammed when the same assignment is re-saved.

## 7. Success metrics

| Metric | Source |
|---|---|
| Active demands and red-flag (aged) count | `/api/dashboard` |
| Demand → candidate → interview → offer → join funnel | `ConversionFunnel.tsx` |
| Source effectiveness (naukri / indeed / linkedin / referral / internal) | `SourceEffectivenessChart.tsx` |
| Recruiter submissions & AM TAT | `/api/performance` |
| Offer→join conversion and BGV clearance | offers/onboardings tables |
| Demand aging vs SLA | `src/lib/demands/demandAgingQuery.ts`, `src/lib/demandFulfillment/*` |

## 8. Assumptions

- Single tenant, single company deployment; no tenant isolation column exists.
- `ta` = Recruiter is the codebase's naming; DB value kept for compatibility.
- The legacy `clients` table + `/api/clients` + Client CRM screens are an **older, partially unauthenticated module** deliberately left intact (`docs/ROLES_AND_PERMISSIONS.md`); it is *not* the Clients master (`companies`).
- Free-text compensation bounds are stored and displayed verbatim; no parsing, no grouping (`formatCompensationRange`).
- `/api/logs` falls back to synthesised sample rows when the `activity_logs` table is absent — a migration-period shim.

## 9. Risks

| Risk | Why it matters |
|---|---|
| Permissions spread across many `src/lib/auth/*.ts` files | Easy to introduce a hand-rolled role check that bypasses the predicates |
| UI gating treated as security | Frontend filters are UX only; every write route must re-check server-side |
| Raw SQL is used for aging/derived data (`demandAgingQuery.ts`, `$queryRaw`) | Column names come from string constants — `Prisma.raw` identifiers must stay allow-listed (`src/lib/auth/rawSqlIdentifier.ts`) |
| No automated test coverage beyond three unit test files | Regressions surface manually; verification steps in `docs/RULES.md` are mandatory |
| Activity-log table may not exist in prod | Route silently returns fake data |
| Single contact slot per demand (`contact_profile_id`) | Simultaneous AM + SPOC assignment is not representable today |
| Company rounds are written by two paths (Clients Master, first-time demand seed) | A future edit that adds a third writer — or lets a demand replace a configured list — would silently change every existing and future demand of that company |

## 10. Out of scope

- Multi-tenancy / per-org isolation
- Real-time transports (WebSocket/SSE) — notifications are polling by design
- File/object storage for resumes or BGV documents (checklists are status-only; `documents_status` is JSON)
- Email-based candidate/client portals; outbound email exists only for password reset and SMTP testing
- WhatsApp campaign integration (`src/components/crm/WhatsappCampaigns.tsx` is legacy UI)
- Mobile/native clients
- BI/reporting warehouse, data-lake or ML features

## 11. Acceptance criteria (per core feature)

- **F1 Auth** — Unauthenticated request to any non-auth page redirects to `/login`; authenticated request to `/login` redirects to `/org-overview`. Wrong password → 401 with a generic error. Reset link is single-use and time-limited. `password_hash` is never returned by any endpoint.
- **F2 Dashboard** — Every tile/chart reflects current DB state. A metric with no supporting data renders blank, not zero/invented.
- **F3 Demands** — AM sees only demands they own (unless role is in `DEMAND_VIEW_ALL_ROLES`). Delete requires ownership **and** status in `DEMAND_DELETABLE_STATUSES`. Clone creates a brand-new demand with `cloned_from_demand_id` set and inherits no candidates/interviews/offers/status history. Import rejects rows failing the schema and reports per-row failures.
- **F5b Add Existing Candidate (all candidates, infinite scroll)** — Demand detail > Pipeline's "Add Existing Candidate" lists the **whole** candidate master pool: the demand-skills filter is gone, and the list loads on open with no minimum characters to type. Pages are keyset-paginated 20 at a time on `(created_at DESC, id DESC)` with an opaque cursor, loading the next 20 as the user scrolls to the bottom until the end (no duplicates, no skips, and no more requests once the list is exhausted). Search is done by the backend — name, email, phone and skills, case-insensitive partial, debounced ~300 ms — and a new search resets the list to its own first 20 while scroll still works. While a page is loading a small loader row shows at the bottom, an empty state covers "no matches", and a slow response for an older search can never overwrite a newer one. Candidates already in this demand's pipeline are listed but disabled with an "Already in pipeline" label. Selecting a candidate prefills **Source** from that candidate's saved source (Naukri, LinkedIn, Direct Portal, Referral, Others); it stays editable, a candidate with no saved source keeps the current default, and the chosen source is saved on the pipeline entry exactly as before. The 25-candidate cap check and the Remark field are unchanged, as is Add New Candidate and Interviews & Schedules.
- **F3d Role category on a candidate** — identical to the demand rule, on **Key Skills**: the picked category is saved on the candidate (`candidates.skills_category_id`), Edit Candidate preselects it with the saved skills shown as selected, changing it behaves like Add, and it is never inferred from the saved skills. Optional, stored by id, blank for old candidates, blank dropdown when the category is deleted or deactivated, cleared with `null`, and no new column in the candidate export or bulk import.
- **F3c Role category on a demand** — Add/Edit Demand's Required Skills field offers the skills-library categories ("Full stack developer"); picking one fills the skills **and** saves the chosen category on the demand (`demands.skills_category_id`). Edit Demand preselects the saved category and shows the saved skills as selected. The category is **never inferred from the saved skills**. It is optional: blank means "none picked". It is stored **by id**, so renaming a category shows its new name everywhere with no backfill; deleting or deactivating one leaves the demand's category empty and its dropdown **blank** (never a stale preselect) with the skills untouched. Changing the category in Edit behaves exactly like Add — it adds that category's skills and never clears existing ones. **Old demands keep no category** (no migration, no guessing) and open with a blank dropdown and their saved skills. Clone does not carry the category over. Demand bulk import and the Excel export gain no new column.
- **F3b Manual Request ID rules** — a manually typed Request ID (Add Demand, and the `Request ID` column of the demand bulk import) allows only `A-Z a-z 0-9 - _`, must start with a letter or a digit, is 3–30 characters after trimming leading/trailing whitespace only, is **stored UPPERCASE**, and is unique **case-insensitively**. An ID matching the auto-generated `CSF-YYYY-NNNN` scheme is refused with exactly *"This format is reserved for auto-generated IDs"*, and the auto-generator skips any ID that already exists. A **blank** field still auto-generates, unchanged. The Request ID is **immutable after creation**: read-only in Edit Demand, and `PUT /api/demands` answers `409 REQUEST_ID_IMMUTABLE` for a changed value (re-sending the same value is accepted and ignored). Demands created before these rules (lowercase, spaces) still open and save every other field — no migration, no rewrite. One shared validator (`src/lib/demands/demandRequestIdRules.ts`) is used by the form, `POST /api/demands` and bulk import; a bad import row fails on its own with that row's reason and never blocks the rest of the file.
- **F3a Company bulk import/export** — Clients Master offers **Export (.xlsx/.csv)**, **Download Template (.xlsx/.csv)** and **Import Companies**, gated to Super Admin and Account Manager both in the UI and on every endpoint (`403` otherwise). Export reflects the current search and status filters. Import columns: Company Name (required), Client Name, Status (Active/Inactive, default Active), Company Email, Phone, Website, Address, City, State, Country, SPOC Email, Interview Rounds. **Company Name is the unique key**, matched case- and whitespace-insensitively; an existing company is **skipped and never overwritten**, and duplicates inside one file resolve to the first row winning. `SPOC Email` must be an existing SPOC profile, otherwise that row fails. Email/phone/website are validated exactly as the Add Company form validates them. The result summary reports created, skipped and failed with per-row reasons, and a failed row never blocks a valid one.
- **F4 Demand detail** — Pipeline / Interviews / Onboarding are separate URLs; an unknown or retired tab id normalises to Pipeline instead of rendering blank. The overview card renders on every tab.
- **F5 Assignment** — Super Admin can assign any AM/SPOC; an AM can assign only themselves or SPOCs (`canAssignDemandTo` enforced server-side). Re-saving with unchanged assignments produces zero notifications.
- **F6 Candidates** — Duplicate email or phone returns `409` with `isDuplicate: true` and the conflicting record. Recruiters must supply a `requestId` for create. Bulk import is idempotent per row and reports success/failure counts.
- **F7 Pipeline** — Only transitions in the defined status machine are accepted; entering `On Hold`/`Cancelled` requires a remark; backward pipeline moves require a remark. Every accepted move writes a `submission_events` row.
- **F8 Interviews** — Effective rounds resolve in the order demand override → company → global default → `['Technical','HR']`. Interview date/time formats use the UTC-anchored formatters for `@db.Date`/`@db.Time` columns. Bulk status/delete report per-item results.
- **F9 Offers/Onboarding** — HR can create/update; other roles read-only per the roles doc. `onboardings.submission_id` is unique (one onboarding per submission). `closure_due_at` default is 90 days from joining.
- **F10a Company rounds source of truth** — (1) A company with zero rounds, then Add Demand with `Technical/HR/Coding` ⇒ Clients Master shows exactly those three, in order, with their Mandatory flags. (2) A second demand on the same company with `Technical/CEO/PI` ⇒ Clients Master still shows `Technical/HR/Coding`, and that demand alone has `Technical/CEO/PI`. (3) Edit Company changes the rounds ⇒ the next NEW demand for that company loads the new rounds, while every existing demand keeps its own. (4) Edit Demand with a company that already has rounds ⇒ the company's rounds are byte-for-byte unchanged. Saving with zero rounds succeeds on every screen.
- **F10 Company master** — No delete action exists in UI or API; a company referenced by a demand cannot be removed (`ON DELETE RESTRICT`). Only ACTIVE companies are offered in the demand form. Interview rounds are optional and saved with the company. The Add/Edit Company form also captures an **optional, clearable SPOC** (same picker and role-filtered data source as the Demand form; must be a `spoc` profile). It is company-owned: never mirrored onto a demand. A company saved before this field existed keeps loading and saving with an empty SPOC.
- **F10a Company interview rounds (source of truth)** — Company rounds are written **only** by (A) Add/Edit Company in Clients Master, and (B) a first-time seed from Add/Edit Demand when the company currently has zero rounds (active or inactive). Any other demand-level change affects that demand alone and must never modify the company's rounds. There is no global-suggestions picker anywhere — every round list is typed directly, or inherited from the company. A round has an order, a name (required, unique per company case-insensitively), an optional free-text mode, a Mandatory flag and, for the company's own list, an Active/Inactive flag (new demands never auto-load an inactive round; demands that already have it keep it). Add Company: rounds optional. Edit Company: the full "Round / Mode / Mandatory / Usage / Actions / Status" editor — add/rename/mode-edit/delete/reorder/Mandatory/Active-Inactive, and the only place existing company rounds change. A round already **in use** — by one of the company's own demands or a candidate interview, shown as a "Usage" badge — cannot be renamed, have its mode changed, or be deleted (edit/delete show a lock icon and a tooltip; reorder, Mandatory and the Active/Inactive toggle stay allowed); the API enforces this with a `409`. Add Demand: a company with active rounds auto-loads them (customizable for this demand only, helper text "Pick a client to load its saved rounds." when no client is chosen yet); a company with none shows an empty editor to type into, seeded onto the company on save. Edit Demand: company read-only, the demand's own saved rounds load, changes are demand-only, and the seed applies only if the company has no rounds at save time. A demand's own round can be deleted only if no candidate interview on that demand uses it. Saving with zero rounds always works.
- **F10b Rounds validation** — `"  Technical "` is stored as `Technical`; a blank name is `400`; `Alpha` + `alpha` in one list is `400`; a sparse incoming order (e.g. `order: 9`) is stored as `order: 1`. **Edit Company applies no in-use check** — delete, rename, add, reorder, Mandatory and clear are always allowed, even for a round a demand of that company uses, and existing demands keep their own rounds either way. The in-use protection lives only in Edit Demand (see F10c).
- **F10c Edit Demand in-use protection** — a round of this demand that already has interviews cannot be deleted or renamed; the whole save is rejected with `409 ROUND_IN_USE` naming the round (`'Technical' already has 1 interview in this demand, so it cannot be deleted or renamed.`). Reorder and Mandatory are always allowed, including on an in-use round. Scoped to this demand only — the same round name used by another demand or company never blocks an edit here. Matching is by the round's stable id, so a rename cannot slip through and delete-then-re-add under the same name is treated as a delete. — Names are trimmed; empty names and case-insensitive duplicates are rejected; the stored order is re-derived as a dense 1..n. Removing or renaming a round that an existing demand or interview of that company uses is blocked with a message naming the blocking usage; reordering and Mandatory changes are always allowed. Editing company rounds changes only what **new** demands inherit — existing demands keep the rounds they were created with.
- **F11 Users** — Super Admin only. Deleting/deactivating a user must not orphan FK-referenced rows.
- **F12 Notifications** — Recipient always comes from the session, never a request param. Reading another user's notification returns 404 (not 403). Only `spoc` and `ta` get the bell. A notification for a demand the user can no longer view renders without a link.
- **F13 Performance** — All metrics computed from real queries; unsupported metrics return `null`.
- **F14 Settings** — Super Admin mutations are gated by `canManageSuperAdminSettings`. Master reorder endpoints preserve `sort_order`.
- **F14a Settings item lifecycle** — Every remaining Demand Fulfillment Settings list tab (Compensation currency + type, Skills library skills and categories, Onboarding documents, BGV checklist; Resume cap excluded) offers **Edit (rename), Delete and Active/Inactive** for every item. A referenced ("in use") item has Edit and Delete **disabled** with a tooltip naming its non-zero usage counts; Mandatory/Required toggles, drag reorder and the Active/Inactive switch stay enabled. An inactive item stays in the list, muted with an "Inactive" badge, and left-menu counts show active items only. Deactivating never changes an existing record. Pickers offer active items only; an Edit modal still shows an inactive saved value as a selected option, and saving it unchanged succeeds. **Default interview rounds, Interview modes and Experience levels tabs were removed entirely** (UI, data and APIs) — see the "Demand Fulfillment Settings — removed tabs" note in ARCHITECTURE.md.
- **F15 Logs** — Route never 500s when `activity_logs` is missing.
- **F16 Closure cron** — Idempotent: re-running does not double-close or duplicate events.
- **F17 Working Days Master Data** — Master data configuration under `/master-data/working-days` allowing setting weekly working days (e.g., 5 or 6 working days) and company-specific or global holiday/off-day schedules.
- **F18 Multi-Round Interview Management** — Slider drawer (`CandidateInterviewDrawer.tsx`) supporting sequential round unlocking, versioned rescheduling with mandatory reasons, and interview rejection cascades.
- **F19 Rate-to-CTC Formula Converter** — Client-level formula editor (`FormulaCreator.tsx`) with AST evaluator (`formulaEngine.ts`) converting hourly/daily bill rates into annual CTC equivalents in real-time.
- **F20 Niche Demand Dual Approval & Dynamic Quotas** — Demands marked `is_niche` require SPOC review approval followed by AM approval before advancing. Company-level `max_submissions_per_position` enforces active submission slots and automatically promotes queued backup candidates upon candidate rejection.
- **F21 Similar Demands & Reporting Enhancements** — Recommendation engine matches candidate skills against open demands. All performance reports include an "Active demands only" scope filter, and the Today's Interviews report supports date-range filtering with clickable daily drilldowns.