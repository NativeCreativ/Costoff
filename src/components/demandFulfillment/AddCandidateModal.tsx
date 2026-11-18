'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormSelect } from '@/components/ui/FormSelect';
import { Loader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/Toast';
import { queryKeys } from '@/lib/queryKeys';
import { useDebounce } from '@/hooks/useDebounce';
import { getDemandCandidatePicker, type DemandPickerCandidate } from '@/services/candidate.service';
import { submissionSourceForCandidate } from '@/lib/candidates/candidateSource';
import { useAddDemandCandidateMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import { useCandidateDemandHistoryQuery } from '@/queries/demandFulfillment/useDemandFulfillmentQueries';
import { useCreateCandidateMutation, getDuplicateCandidateError } from '@/queries/candidates/useCandidateMutations';
import { CandidateFormModal, CandidateFormState } from '@/components/candidates/CandidateFormModal';
import { UNIFIED_SOURCE_VALUES } from '@/lib/demandFulfillment/constants';
import { submissionStatusLabel } from './statusStyles';
import type { Candidate } from '@/components/types';
import { EMPTY_CANDIDATE_PROFILE_FIELDS } from '@/components/candidates/candidateFormDefaults';
import { ReadOnlyChips } from '../ui/ReadOnlyChips';

const EMPTY_CANDIDATE_FORM: CandidateFormState = {
  full_name: '',
  email: '',
  phone: '',
  alternate_phone: '',
  current_location: '',
  preferred_locations: [],
  current_company: '',
  current_designation: '',
  total_experience: '',
  skills: [],
  skills_category_id: '',
  qualification: '',
  specialization: '',
  current_ctc: '',
  expected_ctc: '',
  available_from: '',
  availability: 'Immediate',
  work_mode: 'Work On Site',
  linked_url: '',
  source: 'naukri',
  offer_in_hand: 'no',
  offer_company: '',
  offer_ctc: '',
  offer_doj: '',
  ...EMPTY_CANDIDATE_PROFILE_FIELDS,
};

const SOURCE_OPTIONS = UNIFIED_SOURCE_VALUES.map((v) => ({
  value: v,
  label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}));

interface CapStatus {
  cap: number;
  current: number;
  reached: boolean;
}

interface AddedResult {
  submissionId: string;
  otherDemands: any[];
}

/** Shared attach-to-demand hook used by both entry points below. */
function useAttachCandidateToDemand(requestId: string, source: string, remark: string, onAdded?: (result: AddedResult) => void) {
  const addMutation = useAddDemandCandidateMutation(requestId);
  const [error, setError] = useState<string | null>(null);

  const attach = (
    candidateId: string,
    onDone: () => void,
    onAlreadyInPipeline?: (stage: string | null) => void
  ) => {
    setError(null);
    addMutation.mutate(
      { candidate_id: candidateId, source, remark: remark.trim() || undefined },
      {
        onSuccess: (res) => { onAdded?.({ submissionId: res.submission.id, otherDemands: res.otherDemands }); onDone(); },
        onError: (err) => {
          if (isAxiosError(err) && err.response?.data?.code === 'CANDIDATE_ALREADY_IN_PIPELINE') {
            onAlreadyInPipeline?.(err.response.data.stage ?? null);
            return;
          }
          setError(isAxiosError(err) ? err.response?.data?.error || 'Failed to add candidate' : 'Failed to add candidate');
        },
      }
    );
  };

  return { attach, isPending: addMutation.isPending, error, setError };
}

/* ─────────────────────────────────────────────────────────────────────────
   Existing Candidate — search the master DB and attach a match to this demand.
   ───────────────────────────────────────────────────────────────────────── */
interface SearchExistingCandidateModalProps {
  requestId: string;
  cap: CapStatus;
  onClose: () => void;
  onAdded?: (result: AddedResult) => void;
}

export function SearchExistingCandidateModal({ requestId, cap, onClose, onAdded }: SearchExistingCandidateModalProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [source, setSource] = useState<string>('naukri');
  const [remark, setRemark] = useState('');
  const [capError, setCapError] = useState<string | null>(null);
  // Candidates the server reported as already in this pipeline (race: added by someone else,
  // or a stale search result), hidden from the current result set without a refetch.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const toast = useToast();

  const { attach, isPending, error, setError } = useAttachCandidateToDemand(requestId, source, remark, onAdded);

  // Rule: the whole candidate pool, newest first, paginated by the backend. Search is debounced
// and server-side, so it goes in the query key: a new term starts a fresh first page instead
// of filtering the rows already loaded. useInfiniteQuery drops an in-flight page when the key
// changes, which is what keeps a slow response for an old term from overwriting a newer one.
const pickerQuery = useInfiniteQuery({
    queryKey: queryKeys.demandCandidatePicker(requestId, debouncedSearch),
    queryFn: ({ pageParam }) => getDemandCandidatePicker({ requestId, search: debouncedSearch, cursor: pageParam ?? null }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
  });

  // De-duplicated across pages by id: a candidate added by someone else mid-scroll is hidden
  // client-side without refetching, and the keyset page boundary can never duplicate a row.
  const results = useMemo<DemandPickerCandidate[]>(() => {
    const seen = new Set<string>();
    return (pickerQuery.data?.pages.flatMap((p) => p.candidates) ?? []).filter((c) => {
      if (hiddenIds.has(c.id) || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [pickerQuery.data, hiddenIds]);

  const loadMore = pickerQuery.fetchNextPage;
  const hasMore = pickerQuery.hasNextPage ?? false;
  const isLoadingMore = pickerQuery.isFetchingNextPage;

  // Infinite scroll: the sentinel row at the bottom pulls the next page. Root margin fires
  // before it is actually visible, so the next page is usually already there on arrival.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !pickerQuery.isFetching) loadMore();
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, pickerQuery.isFetching, loadMore, selected]);

  // Info panel — this candidate's history across other demands, shown BEFORE re-adding
  // (per spec: not a blocker, informational only; a rejected/dropped candidate remains
  // eligible for other demands).
  const historyQuery = useCandidateDemandHistoryQuery(selected?.id ?? null);
  const history = historyQuery.data ?? [];

  // Rule: picking a candidate prefills Source from that candidate's own saved source. It stays
// editable, and a candidate with no (or unmapped) source leaves the current default alone.
const handleSelect = (candidate: DemandPickerCandidate) => {
    if (candidate.already_in_pipeline) return;
    setSelected(candidate);
    setSource(submissionSourceForCandidate(candidate.source) ?? source);
  };

  const handleSubmit = () => {
    setCapError(null);
    setError(null);
    if (cap.reached) {
      setCapError(`Active slots are full (${cap.current}/${cap.cap}). This profile will be saved as Backup.`);
    }
    if (!selected) {
      setError('Select a candidate first');
      return;
    }
    if (selected.entryState === 'inactive') {
      const statusLabel = submissionStatusLabel(selected.previousStatus ?? '');
      if (!window.confirm(`Previously ${statusLabel} on this demand. Re-add?`)) return;
    }
    attach(selected.id, onClose, (stage) => {
      // Stale list or a race with another user/tab: surface it, drop them from view, and
      // refresh the board/counter + search — but keep the modal open so the user can pick
      // someone else instead of losing their place.
      toast.error(
        `${selected.full_name} is already in this pipeline${stage ? ` (${submissionStatusLabel(stage)})` : ''}`
      );
      setHiddenIds((prev) => new Set(prev).add(selected.id));
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidatePicker(requestId, debouncedSearch) });
      queryClient.invalidateQueries({ queryKey: queryKeys.demandCandidates(requestId) });
    });
  };
  
  return (
    <Modal title="Add Existing Candidate" subtitle={`Cap: ${cap.current} / ${cap.cap} candidates`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
            placeholder="Search by name, email, phone, or skills…"
            className="h-auto w-full rounded-md border-[#e2e8f0] py-2 pl-9 pr-3 text-[0.85rem] shadow-none"
          />
        </div>

        {selected ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[0.85rem] font-semibold text-[#0f172a]">{selected.full_name}</span>
                  {selected.entryState === 'inactive' && (
                    <Badge className="border-transparent bg-[#fef3c7] text-[0.68rem] font-semibold text-[#92400e] hover:bg-[#fef3c7]">
                      Previously {submissionStatusLabel(selected.previousStatus ?? '')}
                    </Badge>
                  )}
                </div>
                <div className="text-[0.75rem] text-[#64748b]">{selected.email} {selected.phone ? `· ${selected.phone}` : ''}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#94a3b8] hover:text-[#dc2626]"><X className="h-4 w-4" /></button>
            </div>

            {historyQuery.isLoading ? (
              <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc]">
                <Loader message="Checking this candidate's history in other demands…" size="sm" />
              </div>
            ) : history.length > 0 ? (
              <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2">
                <div className="mb-1.5 text-[0.75rem] font-bold text-[#92400e]">
                  This candidate has {history.length} prior demand{history.length > 1 ? 's' : ''} — informational only, not a blocker:
                </div>
                <div className="flex flex-col gap-1">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-2 text-[0.76rem] text-[#78350f]">
                      <span className="truncate">
                        {h.demands?.request_id || h.demand_id} — {h.demands?.company_name || h.demands?.client_name || h.demands?.skill_description || ''}
                      </span>
                      <Badge className="shrink-0 border-transparent bg-white text-[0.68rem] font-semibold text-[#92400e] hover:bg-white">
                        {submissionStatusLabel(h.current_status)}{h.final_result ? ` · ${h.final_result}` : ''}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-[0.76rem] text-[#166534]">
                No prior demand history — this candidate is new to the pipeline.
              </div>
            )}
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto rounded-md border border-[#e2e8f0]">
            {results.length === 0 ? (
              pickerQuery.isLoading ? (
                <Loader message="Loading candidates…" size="sm" />
              ) : (
                <div className="p-4 text-center text-[0.8rem] text-[#94a3b8]">
                  {debouncedSearch.trim()
                    ? 'No candidates match this search.'
                    : 'No candidates yet. Use "Add New Candidate" to create a profile.'}
                </div>
              )
            ) : (
              <>
                {results.map((c) => {
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={c.already_in_pipeline}
                      onClick={() => handleSelect(c)}
                      className={
                        'flex w-full flex-col items-start gap-0.5 border-b border-[#f1f5f9] px-3 py-2 text-left last:border-none ' +
                        (c.already_in_pipeline ? 'cursor-not-allowed bg-[#f8fafc] opacity-60' : 'hover:bg-[#f8fafc]')
                      }
                    >
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[0.83rem] font-semibold text-[#0f172a]">{c.full_name}</span>
                        {c.already_in_pipeline && (
                          <Badge className="border-transparent bg-[#e2e8f0] text-[0.68rem] font-semibold text-[#475569] hover:bg-[#e2e8f0]">
                            Already in pipeline
                          </Badge>
                        )}
                        {!c.already_in_pipeline && c.entryState === 'inactive' && (
                          <Badge className="border-transparent bg-[#fef3c7] text-[0.68rem] font-semibold text-[#92400e] hover:bg-[#fef3c7]">
                            Previously {submissionStatusLabel(c.previousStatus ?? '')}
                          </Badge>
                        )}
                      </span>
                      <span className="text-[0.75rem] text-[#64748b]">{c.email} {c.phone ? `· ${c.phone}` : ''}</span>
                      {(c.skills ?? []).length > 0 && (<div className="mt-1"><ReadOnlyChips items={c.skills ?? []} /></div>)}
                    </button>
                  );
                })}
                {/* Sentinel: its intersection is the only trigger for the next page. */}
                <div ref={sentinelRef} className="py-2 text-center">
                  {isLoadingMore ? (
                    <Loader message="Loading more…" size="sm" />
                  ) : hasMore ? (
                    <span className="text-[0.75rem] text-[#94a3b8]">Scroll for more…</span>
                  ) : (
                    <span className="text-[0.75rem] text-[#94a3b8]">End of list · {results.length} candidate{results.length === 1 ? '' : 's'}</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <FormSelect label="Source" required options={SOURCE_OPTIONS} value={source} onChange={setSource} />

        <div>
          <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">Remark (optional)</label>
          <Textarea
            rows={2}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Note about this candidate…"
            className="w-full resize-y rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
          />
        </div>

        {(cap.reached || capError) && (
          <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[0.78rem] text-[#92400e]">
            {capError || `Active slots are full (${cap.current}/${cap.cap}). Additional profiles are saved as Backup and promoted when an Active profile is rejected.`}
          </div>
        )}
        {error && <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending} className="gap-1.5">
            <UserPlus className="h-4 w-4" /> {isPending ? 'Adding…' : 'Add to Pipeline'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Add New Candidate — the full new-candidate-profile form, same one used
   from Candidate Pipeline → Add New Candidate. On save, the candidate is
   created in the master DB then immediately attached to this demand.
   ───────────────────────────────────────────────────────────────────────── */
interface CreateCandidateForDemandModalProps {
  requestId: string;
  cap: CapStatus;
  onClose: () => void;
  onAdded?: (result: AddedResult) => void;
}

export function CreateCandidateForDemandModal({ requestId, cap, onClose, onAdded }: CreateCandidateForDemandModalProps) {
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(EMPTY_CANDIDATE_FORM);
  const [candidateDedupeError, setCandidateDedupeError] = useState<string | null>(null);

  const createCandidateMutation = useCreateCandidateMutation();

  const handleCreateCandidate = (values: CandidateFormState) => {
    setCandidateDedupeError(null);
    if (cap.reached) {
      setCandidateDedupeError(`Active slots are full (${cap.current}/${cap.cap}). This profile will be saved as Backup.`);
    }
    // requestId is passed so the API links the new candidate to this demand in the same
    // call (and enforces the recruiter-owns-this-demand rule). The attach step that used
    // to follow is gone — calling it now would create a duplicate submission.
    createCandidateMutation.mutate(
      { form: values, requestId },
      {
        onSuccess: ({ candidate, submissionId }) => {
          onAdded?.({ submissionId: submissionId ?? candidate.id, otherDemands: [] });
          onClose();
        },
        onError: (err) => {
          const dup = getDuplicateCandidateError(err);
          if (dup) {
            setCandidateDedupeError(
              `🔴 ${dup.error} Existing profile: ${dup.existingCandidate?.full_name} (${dup.existingCandidate?.email}). Use Add Existing Candidate to add them to this demand.`
            );
            return;
          }
          setCandidateDedupeError('Failed to create candidate');
        },
      },
    );
  };

  return (
    <CandidateFormModal
      candidateForm={candidateForm}
      setCandidateForm={setCandidateForm}
      candidateDedupeError={candidateDedupeError}
      setShowCandidateModal={(open) => { if (!open) onClose(); }}
      handleCreateCandidate={handleCreateCandidate}
    />
  );
}
