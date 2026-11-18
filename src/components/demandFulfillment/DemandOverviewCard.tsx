'use client';

import { Building2, ExternalLink, FileText } from 'lucide-react';
import { formatWorkModes } from '@/components/demands/demand.schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreLessText } from '@/components/ui/MoreLessText';
import { DEMAND_LIFECYCLE_STATUS_COLORS } from './statusStyles';
import type { Demand, DemandAssignment, DemandOnboarding } from '@/components/types';
import { formatCompensationRange } from '@/lib/utils';

interface DemandOverviewCardProps {
  demand: Demand;
  /** Current Assign/Reassign rows — only used to name the AM/SPOC when they differ
   *  from the demand's own contact_profile_id / spoc_profile_id columns. */
  assignments: DemandAssignment[];
  onboardings: DemandOnboarding[];
  /** Gated by canChangeDemandStatus at the call site, same as the old Overview tab. */
  canManage: boolean;
  onOpenAssignModal: () => void;
}

/**
 * The demand summary, rendered ONCE at page level directly above the tab bar so it is
 * visible on every tab. It replaces the old standalone Overview tab: the tab's info card
 * and Assigned Team card are merged here, and the former page header (demand code,
 * company, technology, locations) is folded into the top of the main column.
 *
 * This component is presentational and fetches nothing — the parent view already has the
 * demand, its assignments and its onboardings, so switching tabs causes no refetch.
 */

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  High: { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  Medium: { bg: '#fffbeb', text: '#b45309', border: '#fcd34d' },
  Low: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
};

/** Small muted label above a value, used by the key-facts grid. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.04em] text-[#94a3b8]">{label}</div>
      <div className="mt-0.5 truncate text-[0.86rem] font-semibold text-[#0f172a]" title={typeof value === 'string' ? value : undefined}>
        {value}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 text-[0.75rem] font-medium text-[#334155]">
      {children}
    </span>
  );
}

export function DemandOverviewCard({ demand, assignments, onboardings, canManage, onOpenAssignModal }: DemandOverviewCardProps) {
  const statusColor = DEMAND_LIFECYCLE_STATUS_COLORS[demand.status] || { bg: '#f1f5f9', text: '#64748b' };
  const priorityColor = PRIORITY_COLORS[demand.priority] || PRIORITY_COLORS.Medium;

  // demand_assignments only exists for demands assigned via the Assign/Reassign flow;
  // older demands only carry contact_profile_id / spoc_profile_id, which surface as
  // am_name / spoc_name. Either source is fine — they name the same people.
  const amAssignment = assignments.find((a) => a.role_in_demand === 'account_manager' && a.is_active);
  const spocAssignment = assignments.find((a) => a.role_in_demand === 'spoc' && a.is_active);
  const accountManager = amAssignment?.profiles_demand_assignments_user_idToprofiles?.full_name || demand.am_name || '';
  const spoc = spocAssignment?.profiles_demand_assignments_user_idToprofiles?.full_name || demand.spoc_name || '';

  // Recruiters come from demand.recruiter_names (demand_ta_allocations — the real FK
  // table), not the append-only demand_assignments history log.
  const recruiterNames = Array.from(new Set(demand.recruiter_names ?? []));

  const positions = demand.num_positions ?? 1;
  const joinedCount = onboardings.filter((o) => o.joined_at).length;
  const fillPercent = positions > 0 ? Math.min(100, (joinedCount / positions) * 100) : 0;

  const companyName = demand.company_name || demand.client_name || '—';
  const jobTitle = demand.job_title || demand.skill_description;
  const locations = demand.locations ?? [];
  const technologies = demand.technology_stack ?? [];
  const compensationLabel = `Compensation (${demand.compensation_type_name?.toLowerCase() || 'amount'})`;

  // Company masters store the website inconsistently ("example.com", "https://example.com"),
  // so it is normalized to an absolute href and a short display label before rendering.
  const rawWebsite = demand.company_website?.trim();
  const websiteHref = rawWebsite ? (/^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`) : '';
  const websiteLabel = rawWebsite ? rawWebsite.replace(/^https?:\/\//i, '').replace(/\/+$/, '') : '';

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr]">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="min-w-0 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 font-mono text-[0.72rem] font-semibold tracking-tight text-[#475569]">
              {demand.request_id}
            </span>
            <Badge
              className="border-transparent text-[0.72rem] font-semibold"
              style={{ backgroundColor: priorityColor.bg, color: priorityColor.text, boxShadow: `inset 0 0 0 1px ${priorityColor.border}` }}
            >
              {demand.priority} priority
            </Badge>
            <Badge className="border-transparent text-[0.72rem] font-semibold" style={{ backgroundColor: statusColor.bg, color: statusColor.text }}>
              {demand.status === 'Closure' ? 'Closed' : demand.status}
            </Badge>
          </div>

          <h1 className="mt-2.5 text-[1.35rem] font-medium leading-tight text-[#0f172a]">{jobTitle}</h1>

          {/* Company + its website (resolved from company_id by the read query). The demand's
              own locations live in the Preferred Locations group below, so they are not
              repeated here. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.84rem] text-[#64748b]">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" />
              {companyName}
            </span>
            {websiteHref && (
              <>
                <span aria-hidden className="text-[#cbd5e1]">•</span>
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open ${websiteLabel} in a new tab`}
                  className="inline-flex max-w-[16rem] items-center gap-1 text-[#2563eb] underline-offset-2 hover:underline"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{websiteLabel}</span>
                </a>
              </>
            )}
          </div>

          <div className="my-4 border-t border-[#f1f5f9]" />

          <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">
            {/* Client also carries the demand's locations, so the primary location is
                readable without scanning further down the card. */}
            <Fact label="Client" value={demand.client_name || companyName} />
            <Fact label="Positions" value={positions} />
            <Fact label="Work mode" value={formatWorkModes(demand) || '—'} />
            <Fact
              label="Experience"
              value={
                demand.experience_levels && demand.experience_levels.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {demand.experience_levels.map((level) => (
                      <Chip key={level}>{level}</Chip>
                    ))}
                  </div>
                ) : (
                  '—'
                )
              }
            />
            <Fact label="Employment type" value={demand.role_category || '—'} />
            <Fact
              label={compensationLabel}
              value={formatCompensationRange(demand.compensation_min, demand.compensation_max)}
            />
          </div>

          {(technologies.length > 0 || locations.length > 0) && (
            <>
              <div className="my-4 border-t border-[#f1f5f9]" />
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <div className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.04em] text-[#94a3b8]">Technology</div>
                  {technologies.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {technologies.map((tech) => (
                        <Chip key={tech}>{tech}</Chip>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[0.8rem] text-[#cbd5e1]">—</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.04em] text-[#94a3b8]">Preferred Locations</div>
                  {locations.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {locations.map((loc) => (
                        <Chip key={loc}>{loc}</Chip>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[0.8rem] text-[#cbd5e1]">—</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* When a demand has no job_title the heading IS the description, so don't repeat it. */}
          {demand.skill_description && demand.skill_description !== jobTitle && (
            <p className="mt-4 text-[0.84rem] leading-relaxed text-[#64748b]">
              {/* Job descriptions run long, so they collapse to 40 words with a More/Less
                  toggle — the same control the demand list used to carry inline. */}
              <MoreLessText text={demand.skill_description} wordLimit={40} charLimit={400} />
            </p>
          )}
          {demand.customer_jd_file_url && (
            <a
              href={demand.customer_jd_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-[#2563eb] hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              Client JD: {demand.customer_jd_file_name || 'attached file'}
            </a>
          )}
        </div>

        {/* ── Assigned Team column ───────────────────────────────────── */}
        <div className="border-t border-[#e2e8f0] bg-[#f8fafc] p-5 lg:border-l lg:border-t-0">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">Assigned Team</span>
            {canManage && (
              <Button size="sm" variant="outline" onClick={onOpenAssignModal}>
                Assign
              </Button>
            )}
          </div>

          <dl className="flex flex-col gap-3 text-[0.83rem]">
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#94a3b8]">Account manager</dt>
              <dd className={`mt-0.5 font-semibold ${accountManager ? 'text-[#0f172a]' : 'text-[#94a3b8]'}`}>
                {accountManager || 'Unassigned'}
              </dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#94a3b8]">SPOC</dt>
              <dd className={`mt-0.5 font-semibold ${spoc ? 'text-[#0f172a]' : 'text-[#94a3b8]'}`}>{spoc || 'Unassigned'}</dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#94a3b8]">Recruiters</dt>
              <dd className="mt-1">
                {recruiterNames.length > 0 ? (
                  <span className="inline-flex flex-wrap gap-1">
                    {recruiterNames.map((name) => (
                      <Badge key={name} className="border-transparent bg-[#f5f3ff] text-[0.72rem] font-semibold text-[#7c3aed] hover:bg-[#f5f3ff]">
                        {name}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span className="text-[0.83rem] text-[#94a3b8]">Unassigned</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#94a3b8]">
              <span>Fill Progress</span>
              <span className="text-[0.78rem] font-bold normal-case tracking-normal text-[#334155]">
                {joinedCount} / {positions}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
              <div className="h-full rounded-full bg-[#10b981] transition-[width]" style={{ width: `${fillPercent}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}