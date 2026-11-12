'use client';

import { isAxiosError } from 'axios';
import { useToast } from '@/components/ui/Toast';
import { SettingsChecklistSection } from './SettingsChecklistSection';
import { useToggleBgvChecklistItemMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import type { SuperAdminSettingsPatch } from '@/components/types';

interface BgvChecklistSectionProps {
  checklist: { name: string; required: boolean; isActive: boolean }[];
}

export function BgvChecklistSection({ checklist }: BgvChecklistSectionProps) {
  const toggleMutation = useToggleBgvChecklistItemMutation();
  const toast = useToast();

  const handleToggle = (item: { name: string; isActive: boolean }) => {
    const nextIsActive = !item.isActive;
    toggleMutation.mutate(
      { name: item.name, isActive: nextIsActive },
      {
        onSuccess: () => toast.success(nextIsActive ? 'Checklist item activated' : 'Checklist item deactivated'),
        onError: (err) => {
          const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to toggle checklist item' : 'Failed to toggle checklist item';
          toast.error('Toggle failed', message);
        },
      }
    );
  };

  return (
    <SettingsChecklistSection
      items={checklist}
      withRequiredCheckbox
      addPlaceholder="Checklist item"
      itemLabel="checklist item"
      toPayload={(items): SuperAdminSettingsPatch => ({ bgv_checklist: items })}
      onToggleItem={handleToggle}
      togglePending={toggleMutation.isPending}
    />
  );
}
