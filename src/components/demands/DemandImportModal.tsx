'use client';

import { BulkImportModal, type BulkParseResult } from '@/components/bulk/ImportModal';
import { DEMAND_IMPORT_FIELDS, type DemandImportFieldKey } from '@/constants/demandImportFields';
import { useParseDemandImportMutation, useBulkImportDemandsMutation } from '@/queries/demands/useDemandImportMutations';
import { getDemandImportTemplateUrl, parseDemandImportFile, bulkImportDemands, type DemandImportResult } from '@/services/demandImport.service';
import type { BulkImportOutcome, BulkImportRowOutcome } from '@/lib/bulk/importResult';

interface DemandImportModalProps {
  onClose: () => void;
  onDone: () => void;
}

/**
 * Demand bulk import. A thin wrapper over the shared `BulkImportModal` — the upload, column
 * mapping, required-field warning, preview and result summary all live there, so this file
 * only supplies the Demand field list and its two service calls.
 */
export function DemandImportModal({ onClose, onDone }: DemandImportModalProps) {
  const parseMutation = useParseDemandImportMutation();
  const importMutation = useBulkImportDemandsMutation();

  /** Demand keeps its own `success: boolean` wire shape; adapt it for the shared modal. */
  const toOutcome = (raw: unknown): BulkImportOutcome => {
    const res = raw as DemandImportResult;
    const results: BulkImportRowOutcome[] = res.results.map((r) => ({
      row: r.row,
      label: r.request_id,
      status: r.success ? 'created' : 'failed',
      error: r.error,
    }));
    return {
      totalRows: res.totalRows,
      successCount: res.successCount,
      failureCount: res.failureCount,
      skippedCount: 0,
      results,
    };
  };

  return (
    <BulkImportModal<DemandImportFieldKey>
      title="Import Demands"
      subtitle="Upload a .xlsx, .xls or .csv file of requirements to create in bulk"
      entityLabel="Demands"
      fileLabel="Demand"
      fields={DEMAND_IMPORT_FIELDS}
      getTemplateUrl={getDemandImportTemplateUrl}
      parseFile={(file) => parseMutation.mutateAsync(file) as Promise<BulkParseResult<DemandImportFieldKey>>}
      runImport={(mapping, rows) => importMutation.mutateAsync({ mapping, rows })}
      toOutcome={toOutcome}
      onClose={onClose}
      onDone={onDone}
    />
  );
}