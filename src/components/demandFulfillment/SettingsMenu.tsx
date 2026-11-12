'use client';

import { cn } from '@/lib/utils';
import { SETTINGS_SECTION_GROUPS, type SettingsSectionKey } from './settingsSections';

interface SettingsMenuProps {
  activeKey: SettingsSectionKey;
  onSelect: (key: SettingsSectionKey) => void;
  /** Count badge per item, e.g. "Default interview rounds  3" — omit for no badge. */
  counts: Partial<Record<SettingsSectionKey, number>>;
}

/**
 * Left section menu for Demand Fulfillment Settings: grouped items, one active at a time.
 * Vertical list on desktop (~190px wide); horizontal scrollable tabs on small screens (see the
 * `md:` breakpoint below) per the redesign spec. Purely navigation — it never holds any of the
 * settings data itself. Every section saves itself immediately, so there is no cross-section
 * "needs attention" indicator to show here anymore.
 */
export function SettingsMenu({ activeKey, onSelect, counts }: SettingsMenuProps) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex shrink-0 gap-1 overflow-x-auto pb-1 md:w-[190px] md:flex-col md:gap-4 md:overflow-visible md:pb-0"
    >
      {SETTINGS_SECTION_GROUPS.map((group) => (
        <div key={group.label} className="shrink-0 md:shrink">
          <div className="mb-1 hidden px-2 text-[0.68rem] font-extrabold uppercase tracking-[0.06em] text-[#94a3b8] md:block">
            {group.label}
          </div>
          <div className="flex gap-1 md:flex-col">
            {group.items.map((item) => {
              const isActive = item.key === activeKey;
              const count = counts[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelect(item.key)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-[0.82rem] font-medium transition-colors',
                    isActive ? 'bg-[#eff6ff] text-[#2563eb]' : 'text-[#475569] hover:bg-[#f1f5f9]'
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {typeof count === 'number' && (
                    <span
                      className={cn(
                        'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[0.68rem] font-semibold',
                        isActive ? 'bg-[#dbeafe] text-[#2563eb]' : 'bg-[#e2e8f0] text-[#64748b]'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
