'use client';

import { isAxiosError } from 'axios';
import { useToast } from '@/components/ui/Toast';
import { SettingsChecklistSection } from './SettingsChecklistSection';
import { useToggleOnboardingDocumentMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import type { SuperAdminSettingsPatch } from '@/components/types';

interface OnboardingChecklistSectionProps {
  checklist: { name: string; required: boolean; isActive: boolean }[];
}

export function OnboardingChecklistSection({ checklist }: OnboardingChecklistSectionProps) {
  const toggleMutation = useToggleOnboardingDocumentMutation();
  const toast = useToast();

  const handleToggle = (item: { name: string; isActive: boolean }) => {
    const nextIsActive = !item.isActive;
    toggleMutation.mutate(
      { name: item.name, isActive: nextIsActive },
      {
        onSuccess: () => toast.success(nextIsActive ? 'Document activated' : 'Document deactivated'),
        onError: (err) => {
          const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to toggle document' : 'Failed to toggle document';
          toast.error('Toggle failed', message);
        },
      }
    );
  };

  return (
    <SettingsChecklistSection
      items={checklist}
      withRequiredCheckbox
      addPlaceholder="Document name"
      itemLabel="document"
      toPayload={(items): SuperAdminSettingsPatch => ({ onboarding_document_checklist: items })}
      onToggleItem={handleToggle}
      togglePending={toggleMutation.isPending}
    />
  );
}
