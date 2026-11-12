'use client';

import { ReactNode, useState } from 'react';
import { Loader } from '@/components/ui/Loader';
import { useSuperAdminSettingsDFQueryIncludeInactive } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { useCompensationCurrenciesQueryIncludeInactive, useCompensationTypesQueryIncludeInactive } from '@/queries/settings/useCompensationMastersQueries';
import { useSkillsLibraryQueryIncludeInactive } from '@/queries/settings/useSkillsLibraryQueries';
import { CompensationCurrenciesSection } from './CompensationCurrenciesSection';
import { CompensationTypesSection } from './CompensationTypesSection';
import { SkillsLibrarySection } from './SkillsLibrarySection';
import { ResumeCapSection } from './ResumeCapSection';
import { OnboardingStepsSettings } from './OnboardingStepsSettings';
import { useOnboardingStepTemplatesQuery } from '@/queries/onboarding/useOnboardingSteps';
import { BgvChecklistSection } from './BgvChecklistSection';
import { SettingsMenu } from './SettingsMenu';
import type { SettingsSectionKey } from './settingsSections';

function SettingsPanel({ active, title, description, children }: { active: boolean; title: string; description?: string; children: ReactNode }) {
  return (
    <div className={active ? 'block' : 'hidden'}>
      <h3 className="text-[1rem] font-medium text-[#0f172a]">{title}</h3>
      {description && <p className="mb-3 text-[0.78rem] text-[#94a3b8]">{description}</p>}
      {children}
    </div>
  );
}

export function SuperAdminSettingsView() {
  // The settings view requests includeInactive so inactive rows are shown muted; form pickers
  // keep using the default (active-only) query key.
  const settingsQuery = useSuperAdminSettingsDFQueryIncludeInactive();

  // Count badges only — these queries are already fetched (and cached) by the Compensation/Skills
  // sections themselves; calling the hooks again here just reads the same React Query cache.
  const currenciesQuery = useCompensationCurrenciesQueryIncludeInactive();
  const typesQuery = useCompensationTypesQueryIncludeInactive();
  const skillsLibraryQuery = useSkillsLibraryQueryIncludeInactive();
  const defaultOnboardingStepsQuery = useOnboardingStepTemplatesQuery(null);

  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('resume-cap');

  if (settingsQuery.isLoading || !settingsQuery.data) {
    return <Loader message="Loading settings…" />;
  }

  const data = settingsQuery.data;

  // Menu count badges count ACTIVE items only.
  const counts: Partial<Record<SettingsSectionKey, number>> = {
    compensation: (currenciesQuery.data?.filter((c) => c.is_active).length ?? 0) + (typesQuery.data?.filter((t) => t.is_active).length ?? 0),
    'skills-library': (skillsLibraryQuery.data ?? []).reduce(
      (sum, c) => sum + (c.is_active ? c.skills.filter((s) => s.is_active).length : 0),
      0
    ),
    // Active steps in the Default list (client lists are counted on their own page).
    'onboarding-checklist': (defaultOnboardingStepsQuery.data?.steps ?? []).filter((s) => s.is_active).length,
    'bgv-checklist': data.bgv_checklist.filter((d) => d.isActive).length,
  };

  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-col">
      <div className="mb-4 shrink-0">
        <h2 className="text-[1.1rem] font-bold text-[#0f172a]">Demand Fulfillment Settings</h2>
        <p className="text-[0.82rem] text-[#64748b]">Global defaults used across all demands unless a demand has its own override.</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 md:flex-row">
        <SettingsMenu activeKey={activeSection} onSelect={setActiveSection} counts={counts} />

        <div className="min-w-0 flex-1 rounded-xl border border-[color:var(--card-border)] bg-white p-5 shadow-[var(--card-shadow)]">
          <SettingsPanel
            active={activeSection === 'resume-cap'}
            title="Resume Cap Per Position"
            description="Maximum candidates per open position (e.g. 4 positions × 3 = 12 max candidates on that demand)."
          >
            <ResumeCapSection value={data.resume_cap_per_position} />
          </SettingsPanel>

          <SettingsPanel active={activeSection === 'compensation'} title="Compensation" description="Currencies and frequencies available on the Demand form's Compensation fields. Drag a row to reorder either list.">
            <div className="flex flex-col gap-5">
              <div>
                <div className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#94a3b8]">Currency</div>
                <CompensationCurrenciesSection />
              </div>
              <div className="border-t border-[#e2e8f0] pt-5">
                <div className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#94a3b8]">Type</div>
                <CompensationTypesSection />
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel
            active={activeSection === 'skills-library'}
            title="Skills Library"
            description="Role categories and skills offered by the Required/Key Skills picker. Renaming or deleting an entry never changes skills already saved on a demand or candidate."
          >
            <SkillsLibrarySection />
          </SettingsPanel>

          <SettingsPanel
            active={activeSection === 'onboarding-checklist'}
            title="Onboarding Steps"
            description="The ordered steps the team follows to onboard a candidate: a Default list, plus a custom list for any client that needs one."
          >
            <OnboardingStepsSettings />
          </SettingsPanel>

          <SettingsPanel active={activeSection === 'bgv-checklist'} title="BGV Checklist" description="Background verification items tracked for every candidate who joins.">
            <BgvChecklistSection checklist={data.bgv_checklist as { name: string; required: boolean; isActive: boolean }[]} />
          </SettingsPanel>
        </div>
      </div>
    </div>
  );
}
