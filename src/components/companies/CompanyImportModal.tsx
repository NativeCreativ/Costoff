'use client';

import { BulkImportModal, type BulkParseResult } from '@/components/bulk/ImportModal';
import { COMPANY_IMPORT_FIELDS, type CompanyImportFieldKey } from '@/constants/companyImportFields';
import { useParseCompanyImportMutation, useBulkImportCompaniesMutation } from '@/queries/companies/useCompanyImportMutations';
import { getCompanyImportTemplateUrl, type CompanyImportResult } from '@/services/companyImport.service';
import type { BulkImportOutcome, BulkImportRowOutcome } from '@/lib/bulk/importResult';

interface CompanyImportModalProps {
  onClose: () => void;
  onDone: () => void;
}

/**
 * Clients Master bulk import — a thin wrapper over the shared `BulkImportModal`, mirroring
 * `DemandImportModal`. It contributes only the Company field list and its two service calls;
 * the upload, column mapping, preview, summary and error report are the shared components.
 */
export function CompanyImportModal({ onClose, onDone }: CompanyImportModalProps) {
  const parseMutation = useParseCompanyImportMutation();
  const importMutation = useBulkImportCompaniesMutation();

  const toOutcome = (raw: unknown): BulkImportOutcome => {
    const res = raw as CompanyImportResult;
    const results: BulkImportRowOutcome[] = res.results.map((r) => ({
      row: r.row,
      label: r.name,
      status: r.status,
      error: r.error,
    }));
    return {
      totalRows: res.totalRows,
      successCount: res.successCount,
      failureCount: res.failureCount,
      skippedCount: res.skippedCount,
      results,
    };
  };

  return (
    <BulkImportModal<CompanyImportFieldKey>
      title="Import Companies"
      subtitle="Upload a .xlsx, .xls or .csv file of companies to create in bulk"
      entityLabel="Companies"
      fileLabel="Company"
      fields={COMPANY_IMPORT_FIELDS}
      getTemplateUrl={getCompanyImportTemplateUrl}
      parseFile={(file) => parseMutation.mutateAsync(file) as Promise<BulkParseResult<CompanyImportFieldKey>>}
      runImport={(mapping, rows) => importMutation.mutateAsync({ mapping, rows })}
      toOutcome={toOutcome}
      onClose={onClose}
      onDone={onDone}
    />
  );
}