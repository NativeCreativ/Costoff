'use client';

import { useMemo, useState, useCallback } from 'react';
import { isAxiosError } from 'axios';
import { UserPlus, UserSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Loader } from '@/components/ui/Loader';
import { PipelineKanbanBoard } from './PipelineKanbanBoard';
import { SearchExistingCandidateModal, CreateCandidateForDemandModal } from './AddCandidateModal';
import { CandidateDetailPanel } from './CandidateDetailPanel';
import { RemarkDialog } from './RemarkDialog';
import { useDemandCandidatesQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { useChangeSubmissionStatusMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import { UNIFIED_SOURCE_VALUES } from '@/lib/demandFulfillment/constants';
import { formatSourceLabel } from '@/lib/candidates/sourceLabels';
import { checkSubmissionStatusTransition } from '@/lib/demandFulfillment/statusTransitions';
import { submissionStatusLabel, PIPELINE_KANBAN_COLUMNS } from './statusStyles';
import type { DemandAssignment, DemandCandidate } from '@/components/types';

const SOURCE_FILTER_OPTIONS = UNIFIED_SOURCE_VALUES.map((v) => ({ value: v, label: formatSourceLabel(v) }));

interface DemandPipelineTabProps {
  requestId: string;
  canManage: boolean;
  /** Interview-specific permission (excludes spoc, who can manage the pipeline generally
   *  but is read-only for Interviews) — passed through to CandidateDetailPanel. */
  canManageInterviews: boolean;
  recruiters: DemandAssignment[];
}

interface PendingDrop {
  dcs: DemandCandidate[];
  toStatus: string;
  requiresRemark: boolean;
}

interface FailedMove {
  dc: DemandCandidate;
  error: string;
}

export function DemandPipelineTab({ requestId, canManage, canManageInterviews, recruiters }: DemandPipelineTabProps) {
  const [sourceFilter, setSourceFilter] = useState('');
  const [recruiterFilter, setRecruiterFilter] = useState('');
  const [showSearchExistingModal, setShowSearchExistingModal] = useState(false);
  const [showCreateCandidateModal, setShowCreateCandidateModal] = useState(false);
  const [selectedDcId, setSelectedDcId] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [failedMoves, setFailedMoves] = useState<FailedMove[]>([]);
  // Bulk-selection lives here, not in the board, so the "N selected / Move to / Clear"
  // controls can sit inline in this filter bar beside the source/recruiter filters.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const candidatesQuery = useDemandCandidatesQuery(requestId, {
    source: sourceFilter || undefined,
    recruiter_id: recruiterFilter || undefined,
  });
  const statusMutation = useChangeSubmissionStatusMutation(requestId);

  const candidates = candidatesQuery.data?.candidates ?? [];
  const cap = candidatesQuery.data?.cap ?? { cap: 0, current: 0, reached: false };

  const inactiveCandidates = useMemo(() => candidates.filter((c) => !c.is_active), [candidates]);

  const recruiterOptions = recruiters.map((r) => ({
    value: r.user_id,
    label: r.profiles_demand_assignments_user_idToprofiles?.full_name || 'Recruiter',
  }));

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Changing a filter re-queries the board, so a selection made under the old filter
  // could reference cards that are no longer listed. Drop it rather than let the bulk
  // "Move to" act on candidates the user can no longer see.
  const handleSourceFilter = useCallback((v: string) => { setSourceFilter(v); clearSelection(); }, [clearSelection]);
  const handleRecruiterFilter = useCallback((v: string) => { setRecruiterFilter(v); clearSelection(); }, [clearSelection]);

  const handleSingleDrop = useCallback((dc: DemandCandidate, toStatus: string) => {
    const check = checkSubmissionStatusTransition(dc.current_status, toStatus, undefined);
    setDropError(null);
    setFailedMoves([]);
    setPendingDrop({ dcs: [dc], toStatus, requiresRemark: check.requiresRemark });
  }, []);

  const handleMultipleDrop = useCallback((dcs: DemandCandidate[], toStatus: string) => {
    // Check if all moves are allowed (some may require remark, some may be reversals)
    // We need a single remark for all, so if ANY requires remark, we ask for one.
    const requiresRemark = dcs.some(dc => checkSubmissionStatusTransition(dc.current_status, toStatus, undefined).requiresRemark);
    setDropError(null);
    setFailedMoves([]);
    setPendingDrop({ dcs, toStatus, requiresRemark });
  }, []);

  /** Bulk "Move to" from the inline toolbar control. */
  const handleBulkMove = useCallback((toStatus: string) => {
    if (!toStatus) return;
    const dcs = candidates.filter((c) => selectedIds.has(c.id));
    if (dcs.length === 0) return;
    handleMultipleDrop(dcs, toStatus);
  }, [candidates, selectedIds, handleMultipleDrop]);

  const confirmDrop = useCallback((remark: string) => {
    if (!pendingDrop) return;
    setDropError(null);
    setFailedMoves([]);

    const { dcs, toStatus } = pendingDrop;

    // Execute moves sequentially to preserve order and handle partial failures
    const executeMoves = async () => {
      const failures: FailedMove[] = [];
      for (const dc of dcs) {
        try {
          await statusMutation.mutateAsync({ dcId: dc.id, to_status: toStatus, remark: remark || undefined });
        } catch (err) {
          const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to move candidate' : 'Failed to move candidate';
          failures.push({ dc, error: message });
        }
      }
      setFailedMoves(failures);
      setPendingDrop(null);
      if (failures.length === 0) {
        // All successful - invalidation happens via mutation onSuccess
      }
    };

    executeMoves();
  }, [pendingDrop, statusMutation]);

  const retryFailedMoves = useCallback((remark: string) => {
    if (failedMoves.length === 0) return;
    const dcs = failedMoves.map(f => f.dc);
    const toStatus = pendingDrop?.toStatus;
    if (!toStatus) return;
    setFailedMoves([]);
    setPendingDrop({ dcs, toStatus, requiresRemark: dcs.some(dc => checkSubmissionStatusTransition(dc.current_status, toStatus, undefined).requiresRemark) });
    confirmDrop(remark);
  }, [failedMoves, pendingDrop, confirmDrop]);

  const clearFailedMoves = useCallback(() => {
    setFailedMoves([]);
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--card-border)] bg-white p-4 shadow-[var(--card-shadow)]">
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect value={sourceFilter} onChange={handleSourceFilter} options={SOURCE_FILTER_OPTIONS} allLabel="All Sources" />
          {recruiterOptions.length > 0 && (
            <FilterSelect value={recruiterFilter} onChange={handleRecruiterFilter} options={recruiterOptions} allLabel="All Recruiters" />
          )}
          <Badge className={`border-transparent text-[0.78rem] font-bold ${cap.reached ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#f0f9ff] text-[#0369a1]'} hover:bg-inherit`}>
            {cap.current} / {cap.cap} candidates
          </Badge>

          {/* Bulk selection controls, inline in this toolbar rather than floating over the
              board's bottom-right corner. Only mounted while something is checked, so the
              resting toolbar is exactly the filters + cap badge as before. */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] py-1 pl-2.5 pr-1">
              <span className="whitespace-nowrap text-[0.78rem] font-bold text-[#1d4ed8]">{selectedIds.size} selected</span>
              <span className="whitespace-nowrap text-[0.75rem] font-medium text-[#475569]">Move to</span>
              <select
                aria-label="Move selected candidates to stage"
                value=""
                onChange={(e) => handleBulkMove(e.target.value)}
                className="button-select button-select-sm"
              >
                <option value="">— Select stage —</option>
                {PIPELINE_KANBAN_COLUMNS.map((col) => (
                  <option key={col} value={col}>{submissionStatusLabel(col)}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={clearSelection}
                className="cursor-pointer whitespace-nowrap rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1 text-[0.78rem] font-medium text-[#475569] transition-colors hover:bg-[#f1f5f9]"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        {/* Adding a candidate to a pipeline is a mutation, so it is gated by canManage
            (canManageDemandPipeline: Super Admin, the owning AM, or an allocated Recruiter).
            SPOC, hr and viewer are read-only and must not see these buttons at all — the same
            predicate POST /api/demands/[requestId]/candidates enforces, so a hidden button here
            can never correspond to a visible-but-rejected action. */}
        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSearchExistingModal(true)}
              disabled={cap.reached}
              className="gap-1.5 border-[#2563eb] text-[#2563eb] hover:bg-[#eff6ff] hover:text-[#2563eb]"
            >
              <UserSearch className="h-4 w-4" /> Add Existing Candidate
            </Button>
            <Button onClick={() => setShowCreateCandidateModal(true)} disabled={cap.reached} className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Add New Candidate
            </Button>
          </div>
        )}
      </div>

      {candidatesQuery.isLoading ? (
        <Loader message="Loading pipeline…" />
      ) : (
        <PipelineKanbanBoard
          candidates={candidates}
          canManage={canManage}
          onCardClick={(dc) => setSelectedDcId(dc.id)}
          onDropOnColumn={handleSingleDrop}
          onDropMultipleOnColumn={handleMultipleDrop}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      {inactiveCandidates.length > 0 && (
        <div className="rounded-xl border border-[color:var(--card-border)] bg-white p-4 shadow-[var(--card-shadow)]">
          <div className="mb-2 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#94a3b8]">Rejected / Dropped / Backed Out</div>
          <div className="flex flex-wrap gap-2">
            {inactiveCandidates.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedDcId(c.id)}
                className="flex items-center gap-2 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-1.5 text-[0.78rem] font-semibold text-[#991b1b] hover:bg-[#fee2e2]"
              >
                {c.candidates?.full_name || 'Candidate'}
                <Badge className="border-transparent bg-white text-[0.68rem] font-semibold text-[#991b1b] hover:bg-white">{submissionStatusLabel(c.current_status)}</Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {showSearchExistingModal && (
        <SearchExistingCandidateModal
          requestId={requestId}
          cap={cap}
          onClose={() => setShowSearchExistingModal(false)}
          onAdded={(result) => setSelectedDcId(result.submissionId)}
        />
      )}

      {showCreateCandidateModal && (
        <CreateCandidateForDemandModal
          requestId={requestId}
          cap={cap}
          onClose={() => setShowCreateCandidateModal(false)}
          onAdded={(result) => setSelectedDcId(result.submissionId)}
        />
      )}

      {selectedDcId && (
        <CandidateDetailPanel requestId={requestId} dcId={selectedDcId} canManage={canManage} canManageInterviews={canManageInterviews} onClose={() => setSelectedDcId(null)} />
      )}

      {pendingDrop && (
        <RemarkDialog
          title={`Move ${pendingDrop.dcs.length} candidate${pendingDrop.dcs.length > 1 ? 's' : ''} to ${submissionStatusLabel(pendingDrop.toStatus)}`}
          remarkRequired={pendingDrop.requiresRemark}
          isSubmitting={statusMutation.isPending}
          errorMessage={dropError}
          onClose={() => { setPendingDrop(null); setDropError(null); }}
          onConfirm={confirmDrop}
        />
      )}

      {failedMoves.length > 0 && (
        <RemarkDialog
          title={`${failedMoves.length} candidate${failedMoves.length > 1 ? 's' : ''} failed to move`}
          remarkRequired={pendingDrop?.requiresRemark ?? false}
          isSubmitting={statusMutation.isPending}
          errorMessage={failedMoves.map(f => `${f.dc.candidates?.full_name}: ${f.error}`).join('\n')}
          onClose={clearFailedMoves}
          onConfirm={(remark) => retryFailedMoves(remark)}
        />
      )}
    </div>
  );
}
