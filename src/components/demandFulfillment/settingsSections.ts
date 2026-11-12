export type SettingsSectionKey =
  | 'resume-cap'
  | 'compensation'
  | 'skills-library'
  | 'onboarding-checklist'
  | 'bgv-checklist';

export interface SettingsSectionItem {
  key: SettingsSectionKey;
  label: string;
}

export interface SettingsSectionGroup {
  label: string;
  items: SettingsSectionItem[];
}

/** Left-menu structure for the Demand Fulfillment Settings page. Purely a navigation/display
 *  grouping — it does not change what any setting means or how it is stored. */
export const SETTINGS_SECTION_GROUPS: SettingsSectionGroup[] = [
  { label: 'General', items: [{ key: 'resume-cap', label: 'Resume cap' }] },
  { label: 'Compensation', items: [{ key: 'compensation', label: 'Compensation' }] },
  { label: 'Library', items: [{ key: 'skills-library', label: 'Skills library' }] },
  {
    label: 'Checklists',
    items: [
      { key: 'onboarding-checklist', label: 'Onboarding steps' },
      { key: 'bgv-checklist', label: 'BGV checklist' },
    ],
  },
];
