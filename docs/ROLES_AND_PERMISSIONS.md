# Roles & Permissions — Source of Truth

This file is the canonical spec for role-based access control across the ATS. Read
this before touching any permission check, visibility filter, or role-gated UI.
When code and this file disagree, this file wins — fix the code.

`profiles.role` values in the DB: `super_admin`, `account_manager`, `spoc`, `hr`,
`ta` (= Recruiter), `viewer`.

## Notifications (Demand assignment)

`notifications` is a persistent per-user inbox, written **only** by the backend and read over
REST. Delivery to the UI is polling-based (45s unread-count poll + refetch on dropdown open and
window focus) — **no WebSocket / Socket.IO / Server-Sent Events** anywhere in this feature.

| Role | Header bell | `GET /api/notifications` | `GET /api/notifications/unread-count` | Receives assignment notifications |
|---|---|---|---|---|
| `super_admin` | **No** | 403 | 403 | No |
| `account_manager` | **No** | 403 | 403 | No |
| `spoc` | **Yes** | 200 | 200 | Yes (when newly assigned as SPOC) |
| `ta` (Recruiter) | **Yes** | 200 | 200 | Yes (when newly assigned as recruiter) |
| `hr` | **No** | 403 | 403 | No |
| `viewer` | **No** | 403 | 403 | No |

Rules:
- The bell and the APIs share one predicate, `canViewNotifications` in
  `src/lib/notifications/permissions.ts`, so the UI can never show a bell the backend refuses.
- Only **newly assigned** users are notified. Re-saving a demand with unchanged assignments, or
  retrying the same assignment request, produces **zero** notifications. Removals are never
  notified.
- The actor (Super Admin / AM performing the assignment) is never notified merely for doing it.
- Ownership is enforced server-side on every read and every write: the recipient always comes from
  the session, never a request parameter, so a user cannot read or mark-read another user's
  notification (a foreign id returns 404, not 403, so existence isn't leaked).
- A notification never bypasses Demand authorization: `entity_id` is resolved through the app's
  own `canViewDemand` rule when the feed is built, so a notification for a Demand the user can no
  longer see (or that has since been deleted) renders with **no link** instead of a broken or
  unauthorized jump.
- Idempotency is enforced by the unique partial index `notifications_dedupe_key_key`. The key is
  `demand_assigned:{demand_id}:{recipient}:{slot}:{previous-state fingerprint}` — it identifies a
  specific assignment *transition*, so a duplicated submission is suppressed while a legitimate
  re-assignment after a removal still notifies.

## Clients master

`companies` is a **persistent master**: there is no Delete action in the API or the UI, and
`demands.company_id` is `ON DELETE RESTRICT`, so a Company referenced by a Demand can never be
removed. Support for Create / View / Edit / Search only.

| Role | List / view companies | Create / edit company | Configure company interview rounds | Quick-create from Demand form ("+ Add Company") |
|---|---|---|---|---|
| `super_admin` | Yes | Yes | Yes | Yes |
| `account_manager` | Yes | Yes | Yes | Yes |
| `spoc` | Yes (read-only) | No | No | No |
| `hr` | Yes (read-only) | No | No | No |
| `ta` (Recruiter) | No | No | No | No |
| `viewer` | Yes (read-only) | No | No | No |

Notes:
- `spoc` gets **read-only** access (list + view): the Clients master *is* the client
  relationship a SPOC owns, so hiding it from them was wrong. They still cannot create or edit,
  matching their read-only stance everywhere else.
- `ta` is deliberately **excluded entirely**: recruiters have no demand-level CRUD at all, so
  Company visibility/CRUD would be a privilege escalation.
- There is no "company owner" concept — Company is master data, not ownership-scoped like a
  Demand, so an AM may maintain a company another AM created. This is why Company does *not*
  reuse the Demand ownership model.
- Rules live in `src/lib/auth/companyPermissions.ts` and are enforced in
  `src/app/api/companies/**` and `src/app/api/interview-rounds/**`. The UI gates the same
  predicates, but the backend is the boundary.
- The legacy `clients` table is a **separate, older module** (stub API, no auth) used by
  Settings → Clients Master and Client CRM. It is intentionally left untouched and is NOT the
  Clients master.

## Interview Round master

`interview_rounds` is the single reusable master of round identity (Technical / HR /
Managerial / Final HR / Architecture Review …), created via `POST /api/interview-rounds`, which
**reuses an existing round** when the normalized name (LOWER/TRIM) already matches rather than
creating a duplicate. Round *configuration* is stored per scope, always as references to master
ids plus that scope's own order/mandatory flag:

| Scope | Where stored | API |
|---|---|---|
| Global default | `super_admin_settings.interview_rounds_default` (legacy name-only JSON, unchanged) | `PUT /api/admin/settings/demand-fulfillment` |
| Company | `company_interview_rounds` | `PUT /api/companies/[id]/interview-rounds` |
| Demand | `demand_interview_config.rounds` (JSON) + `demand_interview_rounds` (materialized, what `interviews.round_id` references) | `PUT /api/demands/[requestId]/interview-config` |

Resolution precedence (`resolveConfiguredRounds`, `src/lib/demandFulfillment/interviewConfig.ts`):
**demand override → company → global default → hardcoded `['Technical','HR']`**.

An explicit demand override always wins, so changing a Demand's Company never discards a round
configuration somebody set on the demand itself.

Permissions: configuring rounds follows the owning scope's gate — global defaults are Super
Admin only (`canManageSuperAdminSettings`), company rounds follow Company edit
(`canManageCompanyInterviewRounds`), demand rounds follow `canManageInterviewConfig`.
Scheduling against a demand's effective rounds is unchanged and still gated by
`canManageInterview` / `INTERVIEW_DIRECT_CREATE_ROLES`.

One reusable editor drives all of these:
`src/components/interviewRounds/InterviewRoundConfigurator.tsx` (master search-select, inline
create-or-reuse, chips, mandatory toggle, drag-and-drop ordering).

## The 6 roles

| # | Role (DB value) | Summary |
|---|---|---|
| 1 | `super_admin` | Full access to everything. |
| 2 | `account_manager` (AM) | Full access except User Management. Cannot update/delete demands owned by a *different* AM. |
| 3 | `spoc`, `viewer` | Read-only everywhere. |
| 4 | `hr` | CRUD only on offers/onboarding for candidates. Read-only on all Demands (list/view only — see 2026-09-24 update below). Read-only otherwise. |
| 5 | `ta` (Recruiter) | CRUD only on candidates (their own demands' pipeline). No demand-level CRUD (create/edit/delete/status/assign). Read-only on the demand record itself. |

## Demand ownership model

- One demand has exactly **one** Account Manager and **one** SPOC at a time
  (`demands.contact_profile_id` holds whichever of the two is currently the demand's
  contact — see note below). A demand can have **many** recruiters
  (`demand_ta_allocations`), and a recruiter can be on many demands.
- `demands.created_by`: the AM who created the demand.
- `demands.contact_profile_id`: the AM or SPOC currently assigned as the demand's
  contact. An AM "owns" a demand if `created_by === them` OR
  `contact_profile_id === them`.
- A SPOC can be assigned as a **proxy** when the AM is busy — this still uses the
  same single `contact_profile_id` slot; whoever holds it is "the" assigned contact
  at that time. There is currently one contact slot, not separate AM+SPOC slots —
  if/when the product needs both an AM *and* a SPOC assigned simultaneously, that
  requires a schema change (a separate `spoc_profile_id` column) and is out of scope
  until asked for.

## How a demand gets its AM/SPOC assigned — two entry points

**(a) At creation** — `POST /api/demands` (`DemandForm.tsx` → `demand.schema.ts`).
**(b) Later, via reassignment** — `POST /api/demands/[requestId]/assign`
(`DemandAssignModal.tsx`, the Overview tab's "Assign / Reassign" button) or
`PUT /api/demands` (the legacy edit-demand flow, same `DemandForm.tsx`).

Both entry points MUST apply the same assignee-visibility rule:

- **Super Admin assigning**: sees **every** AM and every SPOC in the "Profile
  (AM/SPOC)" picker. Sees every recruiter in the "Recruiter (TA)" picker.
- **Account Manager assigning**: sees **only themselves** and **SPOCs** in the
  "Profile (AM/SPOC)" picker — never another AM. Sees every recruiter in the
  "Recruiter (TA)" picker (recruiters are not scoped to the assigning AM).

This is enforced in **two places, both required**:
1. Frontend filtering of the picker's options (so the wrong choice is never even
   shown) — see `useContactProfilesQuery` consumers.
2. Backend validation of the submitted assignee (`canAssignDemandTo` in
   `src/lib/auth/demandPermissions.ts`) — the frontend filter is UX only; the
   backend check is the actual security boundary. Every route that sets
   `contact_profile_id` or writes a `demand_assignments` row with
   `role_in_demand` of `account_manager`/`spoc` must call `canAssignDemandTo`
   before writing.

## Demand-level CRUD & visibility

| Role | List/view demands | Create | Edit | Delete | Change status / assign | Clone |
|---|---|---|---|---|---|---|
| `super_admin` | All | Yes | Any demand | Any demand (any status) | Any demand | Any **Closed** demand |
| `account_manager` | All | Yes | Only demands they own (`created_by` or `contact_profile_id`) | Only their own, **and only if status is not Closure/Cancelled** | Only their own | Only their own, **and only if status is `Closure`** |
| `spoc` | All | No | No | No | No (read-only) | No |
| `viewer` | All | No | No | No | No (read-only) | No |
| `hr` | All (read-only — see 2026-09-24 update below) | No | No | No | No | No |
| `ta` (Recruiter) | **Only demands they are allocated to** (`demand_ta_allocations`) | No | No | No | No — read-only on the demand record; full CRUD on that demand's *candidate pipeline* only | No |

Notes:
- "Delete" additionally requires the demand's status to be a terminal/closed state
  (`DEMAND_DELETABLE_STATUSES` — currently just `Closure`); Cancelled demands are
  reopenable by an AM, not directly deletable, unless later added to that list.
- AM "edit" includes: field edits, status transitions (Assign→Sourcing→…→Closure,
  On Hold, Cancel, Reopen, Close), and assignment/reassignment — all gated the same
  way (`canEditDemand` / `canChangeDemandStatus` / `canManageDemandAssignments`,
  which all reduce to the same ownership check).
- **Clone Demand** (`canCloneDemand` + `isDemandCloneable` in
  `src/lib/demands/demandClone.ts`) reuses that same ownership check and adds one
  extra rule: the source demand must already be **`Closure`**. Active / Open / In
  Progress demands are never cloneable, in the UI or in the API. Clone itself does not
  need a separate role — it is available to exactly whoever may already create a
  Demand (`DEMAND_WRITE_ROLES`), i.e. Super Admin / Account Manager. The clone is a
  brand-new Demand row created through the normal Create Demand endpoint with
  `cloned_from_demand_id` attached for the audit trail; it inherits no candidates,
  interviews, offers, onboarding/BGV, status history or SLA/aging from the source.

## Candidate pipeline (submissions), interviews, onboarding — inside a demand

| Role | Manage pipeline (add/move candidates, notes, interviews, onboarding, config) |
|---|---|
| `super_admin` | Any demand |
| `account_manager` | Only demands they own |
| `spoc` | Only demands where they are the current `contact_profile_id` |
| `ta` | Only demands they are allocated to (`demand_ta_allocations`) |
| `viewer`, `hr` | None (read-only / no access) |

This is `canManageDemandPipeline` / `canManageInterviewConfig` /
`canChangeDemandStatus` in `src/lib/auth/demandFulfillmentPermissions.ts`.

**Important nuance**: the table above shows SPOC as able to "manage" the pipeline
(review/shortlist/customer feedback), which matches the SPOC's job description.
SPOC is otherwise read-only on the *demand record itself* (can't edit fields,
change demand status, or reassign the team) — SPOC's write access is scoped to the
candidate pipeline of demands they're the contact for, not the demand entity.

## HR's actual scope (separate from all of the above)

**Update (2026-09-24): HR now has read-only visibility into all Demands** (list and
view, same level as `viewer` — `DEMAND_VIEW_ALL_ROLES` includes `hr`). This reverses
the prior "no demand access at all" decision above the CRUD table, per an explicit
product instruction. HR still has **no write access** to demands (no create/edit/
delete/status-change/assign) and **no access to the candidate pipeline** inside a
demand (see the pipeline table above — HR stays "None" there).

HR's write access remains limited to the existing `offers` and `onboardings` tables
at the *candidate* level (outside the demand fulfillment module — e.g.
`/api/offers`, `/api/onboardings`), and is otherwise read-only across the rest of
the app. If HR-specific routes don't yet check this, they need a role gate added
when touched — don't assume HR can reach demand-fulfillment write endpoints just
because no check exists yet.

## Where each rule lives in code

- `src/lib/auth/demandPermissions.ts` — demand CRUD ownership (`canCreateDemand`,
  `canEditDemand`, `canDeleteDemand`, `canAssignDemandTo`,
  `DEMAND_VIEW_ALL_ROLES`, `DEMAND_WRITE_ROLES`).
- `src/lib/auth/demandVisibility.ts` — row-level visibility filter for the
  Demand list query (`buildDemandVisibilityCondition`, applied against the
  `DEMANDS_WITH_AGING_BASE` derived table, `src/lib/demands/demandAgingQuery.ts`).
- `src/lib/auth/demandFulfillmentPermissions.ts` — pipeline/interview/onboarding
  action-level checks (`canManageDemandPipeline`, `canChangeDemandStatus`,
  `canManageDemandAssignments`, `canManageInterviewConfig`,
  `canManageSuperAdminSettings`).
- `src/components/demands/DemandForm.tsx` — frontend AM/SPOC picker filtering for
  create/edit (entry point (a) and the legacy edit path).
- `src/components/demandFulfillment/DemandAssignModal.tsx` — frontend AM/SPOC
  picker filtering for the reassignment flow (entry point (b)).
- `src/app/api/demands/route.ts` (POST/PUT) and
  `src/app/api/demands/[requestId]/assign/route.ts` (POST) — backend enforcement
  for both entry points. **Every one of these must call `canAssignDemandTo` before
  writing an AM/SPOC assignment** — this was previously missing on the `/assign`
  route and must not regress.
- `POST /api/demands` also enforces the **Clone Demand** rules (`canCloneDemand` +
  the `Closure`-status guard) whenever the body carries `cloned_from_demand_id`.
  Hiding the Clone button in the UI is not the boundary — this check is.

## Demand lifecycle (change request vs this file)

The last-round change request lets an assigned SPOC upload profiles in Sourcing,
accept or reject shortlists, and update interview status. This file previously
described SPOC as read-only on the candidate pipeline. `canManageDemandPipeline`
now includes the assigned SPOC for those actions. SPOC still cannot edit the
demand record, change demand status, or reassign the team.

## Master Data Management

The left-nav section is Super Admin only, the same gate as Clients Master writes
(`canManageCompanies`) and Demand Fulfillment Settings (`canManageSuperAdminSettings`).
`canManageMasterData` in `src/lib/auth/masterDataPermissions.ts` is that gate.

Account Managers are not locked out of the demand form. Active-only reads of end
clients, demand categories, locations, demand types, skill groups and interview
statuses are available to any authenticated user, the same way `GET /api/skills-library`
is. Writes (create, rename, delete, reorder, activate) stay Super Admin.

Client Management remains the companies module: Super Admin creates and edits;
the demand client dropdown stays available to Super Admin and Account Manager
(`canUseCompanyDropdown`). Client SPOCs are contacts on the client, not a change
to who may edit the client.

## Checklist for any future change that touches roles/permissions

1. Which of the 6 roles can even see this feature at all? (Default to **denying**
   `hr` and `viewer` write access, and denying `hr` demand access entirely, unless
   this file says otherwise.)
2. If it's demand-CRUD or assignment: does it call `canEditDemand` /
   `canDeleteDemand` / `canAssignDemandTo` — not a hand-rolled role check?
3. If it's pipeline/interview/onboarding: does it call
   `canManageDemandPipeline` / `canChangeDemandStatus` /
   `canManageInterviewConfig` — not a hand-rolled role check?
4. If it renders an AM/SPOC or recruiter picker: is the AM/SPOC list filtered
   client-side per the assigning-role rule above, AND is the same rule re-checked
   server-side? A frontend-only filter is not a security boundary — it must be
   backed by the corresponding `canAssignDemandTo` (or equivalent) server check.
5. Update this file if the rule actually changes (product decision), not just when
   code changes.
6. If the change adds a new action on a Demand (e.g. Clone), it needs BOTH: a
   named predicate in `demandPermissions.ts` / `demandFulfillmentPermissions.ts`
   (reused from the call sites, never hand-rolled role checks), AND a server-side
   re-check in the route that performs the write.

## 2026-11 update — client feedback round

- **Password reset (security fix, 25 Nov 2026):** there is no self-service reset. `/api/auth/forgot-password` and
  `/api/auth/reset-password` answer 403 (they used to set a new password for any posted email, with no
  token). A forgotten password is reset by Super Admin from the Users page (`PUT /api/users/[id]/password`).

- **Skill Groups** (create / edit / delete, and putting a category in a group): `canManageSkillsLibrary`
  (Super Admin), like the rest of the skills library. `GET /api/skill-groups`: any signed-in user.
- **Smart Reports (AI)**: any signed-in user; the data it answers from uses
  `buildDashboardDemandCondition`, and team activity is included for Super Admin only.

- **Review batches 2–5** (Nov 2026):
  - Full PAN (`GET /api/candidates/[id]/pan`): only someone who may edit the candidate
    (`canEditCandidate`). Everyone else sees the last 4 characters.
  - Candidate file upload: `canWriteCandidates`.
  - Call Log edit / Demand Match → Sourcing: `canLogDemandCall` (same as logging a call).
  - Sourcing Submit: `canSubmitSourcedProfile` (pipeline team, or the recruiter who uploaded it).
    Approve / Reject: `canReviewSourcedProfile` (Super Admin, the demand's AM, its SPOC). Recruiters
    can no longer move a profile from Sourcing into Shortlist through the status route.
  - Draft demands: visible to their creator and Super Admin only (`canViewDemand`, list scopes).
  - Team Contribution report: Super Admin sees everyone (`canSeeEveryonesContribution`); anyone
    else sees only their own. Candidate Aging report: dashboard scope.
  - Notification bell: Account Managers now get it (profiles are submitted to them).

- **Account Manager on a demand** (review batch 1): only the Delivery Head (`super_admin`) may set
  or change it — `canReassignDemandAccountManager`, used by `POST /api/demands/[requestId]/assign`
  (other actors' account_manager entries are dropped) and to show the picker on the Assign tab.

These rules supersede the `ta` rows above where they differ.

- **Recruiter (`ta`) demand visibility.** A Recruiter can view **every** demand (list, detail
  tabs, pipeline read-only), not only the ones in `demand_ta_allocations`
  (`canViewDemand`, `buildDemandVisibilityCondition` → no filter for `ta`). Their Demands list
  opens on **"My demands"** (`?assignedToMe=true`, `buildAssignedToMeCondition`); switching to
  "All demands" is a filter choice, not an access rule. Their **dashboard** stays scoped to
  their assigned demands (`buildDashboardDemandCondition`).
- **Upload profiles to any demand.** New predicate `canUploadProfilesToDemand`
  (`demandFulfillmentPermissions.ts`): everyone who can manage the pipeline, plus **any**
  Recruiter. It gates only adding a candidate as Sourced — `POST /api/demands/[requestId]/candidates`
  and `POST /api/candidates` with a `requestId`. The candidate picker on the Candidates page uses
  `?uploadable=true` (`buildDemandUploadableCondition`). Everything after the upload (moving
  stages, interviews, onboarding, sourcing type) stays on `canManageDemandPipeline`, i.e. only
  the **assigned** Recruiters. An unassigned Recruiter also cannot edit the candidate they
  uploaded there (candidate edit still requires demand assignment).
- **Client SPOCs from the demand form.** `GET/POST /api/companies/[id]/spocs` ("Select SPOC" /
  "Add SPOC" on Add/Edit Demand) use `canManageCompanySpocsFromDemand`: Super Admin for any
  client, an Account Manager only for clients they are the AM of. Clients Master itself stays
  Super Admin only. Not-yours answers 404.
- **Customer JD upload** (`POST /api/uploads/jd`): demand-write roles (`canCreateDemand`).
- **Demand Type → Skill Groups** (`PUT /api/demand-type-skill-groups`): `canManageMasterData`.
  The GET is open to any signed-in user, like the other demand-form pickers.
- **Onboarding steps.** Step lists (`/api/onboarding-step-templates`) are Super Admin
  (`canManageSuperAdminSettings`). Updating a candidate's step or attaching its file uses
  `canManageDemandPipeline`, like every other onboarding write; reading uses `canViewDemand`.
- **Change Log** (`GET /api/demands/[requestId]/change-log`): anyone who can view the demand.
- **Candidate Conversation Log** (`/api/candidates/[candidateId]/conversations`): read = anyone
  who can see the candidate (`canAccessCandidate`); add = `canLogCandidateConversation` — any
  `CANDIDATE_WRITE_ROLES` role (Super Admin, AM, Recruiter) on a candidate they can see. Looser
  than candidate edit on purpose: logging a call does not change the record. hr / viewer read only.
- **Task Log** (`/api/task-logs`): every role logs and edits its own tasks. Only Super Admin
  (`canViewAllTaskLogs`) sees and manages everyone's. Another person's task answers 404.
- **To-Do List** (`/api/todos`): written by `TODO_AUTHOR_ROLES` (Super Admin, Account Manager,
  SPOC — `canCreateTodo`). Published items are visible to every role; drafts only to their author.
  Edit / publish / complete / delete: the author, or Super Admin (`canManageTodo`); anything else
  answers 404. (`src/lib/auth/teamWorkPermissions.ts`)
- **Reports** (`/api/reports/*`, sidebar "Reports"): every role, read-only, each report scoped
  server-side — demand reports by `buildDashboardDemandCondition`, Ready to Join by
  `buildCandidateVisibilityCondition`. No report can show a demand or candidate the viewer
  could not open directly.
- **Call Log** (`/api/demands/[requestId]/call-logs`): log = `canLogDemandCall`, the upload rule
  (`canUploadProfilesToDemand`: any Recruiter, the demand's AM / assigned SPOC, Super Admin) —
  a Fit call adds the candidate to the pipeline. Read = `canViewDemand`.
- **Instruction Log** (`/api/demands/[requestId]/instructions`): write = `canWriteDemandInstructions`
  (Super Admin, the demand's current AM, its assigned SPOC); edit / delete = the author while still
  on the demand, or Super Admin (`canManageDemandInstruction`); read = `canViewDemand`.
