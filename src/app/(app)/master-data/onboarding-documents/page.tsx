'use client';

import { RequireRole } from '@/components/layout/RequireRole';
import { MasterDataPage } from '@/components/masterData/MasterDataPage';
import { OnboardingDocumentsMaster } from '@/components/masterData/OnboardingDocumentsMaster';

export default function OnboardingDocumentsPage() {
  return (
    <RequireRole role="super_admin">
      <MasterDataPage
        title="Onboarding Steps"
        description="The ordered steps (with any documents to collect) the team follows to onboard a candidate. Set a Default list, and a custom list for any client that needs one."
      >
        <OnboardingDocumentsMaster />
      </MasterDataPage>
    </RequireRole>
  );
}
