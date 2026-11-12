'use client';

import { useDashboardQuery } from '@/queries/dashboard/useDashboardQuery';
import { useCurrentUserQuery } from '@/queries/auth/useCurrentUserQuery';
import { KpiCard } from './KpiCard';
import { ConversionFunnel } from '@/components/charts/ConversionFunnel';
import { DemandStatusDonut } from '@/components/charts/DemandStatusDonut';
import { TrendChart } from '@/components/charts/TrendChart';
import { AgingBarChart } from '@/components/charts/AgingBarChart';
import { CompanyOverviewTable } from '@/components/charts/CompanyOverviewTable';
import { SourceEffectivenessChart } from '@/components/charts/SourceEffectivenessChart';
import { InterviewActivityChart } from '@/components/charts/InterviewActivityChart';
import { RecruiterPerformanceChart } from '@/components/charts/RecruiterPerformanceChart';
import { AMPerformanceTable } from '@/components/charts/AMPerformanceTable';
import { AttentionRequiredTable } from '@/components/charts/AttentionRequiredTable';
import { navItemById } from '@/lib/navigation/routes';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/redux/hooks';
import { setFilter, LISTS } from '@/features/listState/listStateSlice';
import { TeamTodoCard } from './TeamTodoCard';

/* ─────────────── Card Wrapper ─────────────── */

function Card({
  title,
  subtitle,
  rightElement,
  children,
  className = '',
  style,
  flush = false,
}: {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** No body padding — tables sit edge-to-edge under the header. */
  flush?: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] ${className}`}
      style={{ borderColor: '#e2e8f0', ...style }}
    >
      <div
        className="flex items-center justify-between border-b px-[22px] py-[16px]"
        style={{ borderColor: '#e2e8f0' }}
      >
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold tracking-[-0.2px] text-[#0f172a]">{title}</h2>
          {subtitle ? <p className="mt-[3px] text-[12px] text-[#64748b]">{subtitle}</p> : null}
        </div>
        {rightElement ? <div className="flex shrink-0 items-center gap-3">{rightElement}</div> : null}
      </div>
      <div className={`min-h-0 flex-1 ${flush ? '' : 'p-[20px_22px]'}`}>{children}</div>
    </div>
  );
}

/* ─────────────── Icon Components ─────────────── */

const Icons = {
  openDemands: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  agingDemands: <i className="fa-solid fa-flag" aria-hidden="true" />,
  activeCandidates: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  interviewsToday: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  offersThisMonth: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" rx="2" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  ),
  onboardingsThisMonth: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <polyline points="20 6 23 9 17 15" />
    </svg>
  ),
};

function HeaderLink({ href, onClick, children }: { href: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className="cursor-pointer text-[13px] font-semibold text-[#2563eb] no-underline hover:text-[#1d4ed8] hover:underline"
    >
      {children}
    </a>
  );
}

/* ─────────────── Main Component ─────────────── */

export function OrgOverviewPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { data: dashboardData, isLoading, error } = useDashboardQuery();
  const { data: currentUser } = useCurrentUserQuery();

  const role = currentUser?.role ?? null;

  const isFullSectionRole =
    role === 'super_admin' || role === 'account_manager' || role === 'spoc';

  const navigateTo = (tab: string) => {
    router.push(navItemById(tab)?.href ?? '/org-overview');
  };

  const setRedFlagsOnly = (v: boolean) => {
    dispatch(setFilter({ list: LISTS.demands, key: 'redFlagsOnly', value: String(v) }));
  };

  const companiesHref = navItemById('companies')?.href ?? '/companies';
  const clientAnalyticsHref = navItemById('client_analytics')?.href ?? '/performance/client-analytics';
  const amPerfHref = navItemById('performance_am')?.href ?? '/performance/account-managers';
  const taPerfHref = navItemById('performance_ta')?.href ?? '/performance/recruiters';
  const demandsHref = navItemById('demands')?.href ?? '/demands';

  const kpis = dashboardData?.kpis ?? {
    openDemands: 0,
    sourcingShortlist: 0,
    redFlagDemands: 0,
    activeCandidates: 0,
    candidatesDelta: null,
    interviewsToday: 0,
    interviewsCompletedToday: null,
    interviewsUpcomingToday: null,
    nextInterviewToday: null,
    offersThisMonth: 0,
    offersDelta: null,
    offersAcceptedThisMonth: null,
    onboardingsThisMonth: 0,
    pendingOnboardings: null,
  };

  const sectionLoading = isLoading;
  const sectionError = error ? new Error('Failed to load dashboard') : null;

  const joinedPct = dashboardData?.funnel?.joinedPct ?? null;
  const funnelSubtitle =
    joinedPct === null
      ? 'Submissions by stage'
      : `Sourced \u2192 Joined ${joinedPct}%`;

  const attention = dashboardData?.attentionRequired ?? null;
  const attentionRedFlags = attention?.redFlagCount ?? 0;
  const attentionTotalOpen = attention?.totalDemands ?? attention?.totalCount ?? 0;

  const sourceEffectivenessCard = (
    <Card title="Source Effectiveness" subtitle="Candidates · % submitted">
      <SourceEffectivenessChart
        data={dashboardData?.sourceEffectiveness ?? null}
        isLoading={sectionLoading}
        error={sectionError}
        fullReportHref={clientAnalyticsHref}
      />
    </Card>
  );

  const interviewActivityCard = (
    <Card title="Interview Activity" subtitle="Scheduled per day · this week">
      <InterviewActivityChart
        data={dashboardData?.interviewActivity ?? null}
        isLoading={sectionLoading}
        error={sectionError}
      />
    </Card>
  );

  return (
    <div className="p-[24px_28px]" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* ROW 1 — 6 KPI Cards */}
      <section className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Open Demands"
          value={kpis.openDemands}
          icon={Icons.openDemands}
          iconBgColor="#eff6ff"
          iconColor="#2563eb"
          subLine={kpis.sourcingShortlist > 0 ? `${kpis.sourcingShortlist} in Sourcing + Shortlist` : null}
          subLineColor="#0f766e"
          onClick={() => navigateTo('demands')}
          isLoading={sectionLoading}
          error={sectionError}
        />
        <KpiCard
          label="Demands > 30 Days"
          value={kpis.redFlagDemands}
          icon={Icons.agingDemands}
          iconBgColor="#fee2e2"
          iconColor="#ef4444"
          subLine={kpis.redFlagDemands > 0 ? 'Red flag · review now' : 'All on track'}
          subLineColor={kpis.redFlagDemands > 0 ? '#b91c1c' : '#059669'}
          onClick={() => {
            navigateTo('demands');
            setRedFlagsOnly(true);
          }}
          isLoading={sectionLoading}
          error={sectionError}
        />
        <KpiCard
          label="Active Candidates"
          value={kpis.activeCandidates}
          icon={Icons.activeCandidates}
          iconBgColor="#f5f3ff"
          iconColor="#8b5cf6"
          subLine={
            kpis.candidatesDelta !== null
              ? kpis.candidatesDelta >= 0
                ? `+${kpis.candidatesDelta} vs last month`
                : `${kpis.candidatesDelta} vs last month`
              : null
          }
          subLineColor="#0f766e"
          onClick={() => navigateTo('candidates')}
          isLoading={sectionLoading}
          error={sectionError}
        />
        <KpiCard
          label="Interviews Today"
          value={kpis.interviewsToday}
          icon={Icons.interviewsToday}
          iconBgColor="#ecfeff"
          iconColor="#0891b2"
          subLine={
            kpis.interviewsToday > 0 &&
            (kpis.interviewsCompletedToday !== null || kpis.interviewsUpcomingToday !== null)
              ? `${kpis.interviewsCompletedToday ?? 0} completed · ${kpis.interviewsUpcomingToday ?? 0} upcoming`
              : kpis.nextInterviewToday
                ? `Next: ${kpis.nextInterviewToday}`
                : null
          }
          subLineColor="#64748b"
          onClick={() => navigateTo('interviews')}
          isLoading={sectionLoading}
          error={sectionError}
        />
        <KpiCard
          label="Offers This Month"
          value={kpis.offersThisMonth}
          icon={Icons.offersThisMonth}
          iconBgColor="#fffbeb"
          iconColor="#d97706"
          subLine={
            kpis.offersAcceptedThisMonth !== null
              ? `${kpis.offersAcceptedThisMonth} accepted`
              : kpis.offersDelta !== null
                ? kpis.offersDelta >= 0
                  ? `+${kpis.offersDelta} vs last month`
                  : `${kpis.offersDelta} vs last month`
                : null
          }
          subLineColor="#0f766e"
          onClick={() => navigateTo('offers')}
          isLoading={sectionLoading}
          error={sectionError}
        />
        <KpiCard
          label="Onboardings This Month"
          value={kpis.onboardingsThisMonth}
          icon={Icons.onboardingsThisMonth}
          iconBgColor="#ecfdf5"
          iconColor="#059669"
          subLine={
            kpis.pendingOnboardings !== null && kpis.pendingOnboardings > 0
              ? `${kpis.pendingOnboardings} pending`
              : null
          }
          subLineColor="#64748b"
          onClick={() => navigateTo('offers')}
          isLoading={sectionLoading}
          error={sectionError}
        />
      </section>

      {/* Team To-Do — today's published priority items, visible to every role. */}
      <section className="mb-5">
        <TeamTodoCard />
      </section>

      {/* ROW 2 — Conversion Funnel (2fr) + Demand Status Donut (1fr) */}
      <section className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <Card
          title="Recruitment Conversion Funnel"
          subtitle={funnelSubtitle}
          // rightElement={<span className="text-[12px] text-[#64748b]">Last 6 months</span>}
        >
          <ConversionFunnel
            funnel={dashboardData?.funnel ?? null}
            isLoading={sectionLoading}
            error={sectionError}
          />
        </Card>

        <Card title="Demand Status" subtitle="Open demands by stage">
          <DemandStatusDonut
            data={dashboardData?.demandStatus ?? null}
            isLoading={sectionLoading}
            error={sectionError}
          />
        </Card>
      </section>

      {/* ROW 3 — Trend (2fr) + Demand Aging (1fr) */}
      <section className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <Card
          title="Submissions & Selections Trend"
          subtitle="Monthly"
          rightElement={
            <div className="flex items-center gap-3 text-[12px] text-[#475569]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: '#2563eb' }} />
                Submissions
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: '#0d9488' }} />
                Selections
              </span>
            </div>
          }
        >
          <TrendChart data={dashboardData?.trend ?? null} isLoading={sectionLoading} error={sectionError} />
        </Card>

        <Card title="Demand Aging" subtitle="Open demands by days open">
          <AgingBarChart data={dashboardData?.aging ?? null} isLoading={sectionLoading} error={sectionError} />
        </Card>
      </section>

      {/* ROW 4/5 — Layout depends on the role. */}
      {isFullSectionRole ? (
        <>
          {/* ROW 4 — Company Overview (2fr) + Source Effectiveness (1fr) */}
          <section className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
            <Card
              title="Client Overview"
              subtitle="Demand and pipeline volume by company"
              rightElement={
                <HeaderLink href={companiesHref} onClick={() => navigateTo('companies')}>
                  Client Master
                </HeaderLink>
              }
              flush
            >
              <CompanyOverviewTable
                data={dashboardData?.companyOverview ?? null}
                isLoading={sectionLoading}
                error={sectionError}
              />
            </Card>

            {sourceEffectivenessCard}
          </section>

          {/* ROW 5 — Interview Activity + Recruiter + AM */}
          <section className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {interviewActivityCard}

            <Card
              title="Recruiter Performance"
              subtitle="Month to date"
              rightElement={
                <HeaderLink href={taPerfHref} onClick={() => navigateTo('performance_ta')}>
                  View Full Report
                </HeaderLink>
              }
            >
              <RecruiterPerformanceChart
                data={dashboardData?.recruiterPerformance ?? null}
                isLoading={sectionLoading}
                error={sectionError}
              />
            </Card>

            <Card
              title="AM Performance"
              subtitle="Open demands · offer acceptance"
              rightElement={
                <HeaderLink href={amPerfHref} onClick={() => navigateTo('performance_am')}>
                  View Full Report
                </HeaderLink>
              }
              flush
            >
              <AMPerformanceTable
                data={dashboardData?.amPerformance ?? null}
                isLoading={sectionLoading}
                error={sectionError}
              />
            </Card>
          </section>
        </>
      ) : (
        /* ROW 4 — Source Effectiveness + Interview Activity, side by side */
        <section className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {sourceEffectivenessCard}
          {interviewActivityCard}
        </section>
      )}

      {/* ROW 6 — Attention Required (all roles) */}
      <section className="mb-5">
        <Card
          title="Attention Required"
          subtitle="Top 5 open demands by urgency"
          rightElement={
            <div className="flex items-center gap-2">
              {!sectionLoading && attention ? (
                attentionRedFlags > 0 ? (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[12px] font-extrabold"
                    style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
                  >
                    {attentionRedFlags} red flag
                  </span>
                ) : (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[12px] font-extrabold"
                    style={{ backgroundColor: '#dcfce7', color: '#166534' }}
                  >
                    All on track
                  </span>
                )
              ) : null}
               <HeaderLink
                  href={demandsHref}
                  onClick={() => {
                    navigateTo('demands');
                  }}
                >
                  View All
                </HeaderLink>
            </div>
          }
          style={{ borderTop: '3px solid #dc2626' }}
          flush
        >
          <AttentionRequiredTable
            data={attention}
            isLoading={sectionLoading}
            error={sectionError}
            totalOpenDemands={attentionTotalOpen}
          />
        </Card>
      </section>
    </div>
  );
}
