'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompanyInterviewRounds } from '@/services/company.service';
import type { ConfiguredRound } from '@/services/interviewRound.service';

/** Global default rounds (super_admin_settings.interview_rounds_default), read via the existing
 *  demand interview-config endpoint's fallback. Kept as the last resort before the app's
 *  hardcoded Technical/HR, which the server applies when this list is empty. */
export interface DemandRoundsSource {
  /** Where the currently-loaded rounds came from, for the UI hint. */
  source: 'demand' | 'company' | 'global' | 'none';
  companyId: string | null;
}

export interface UseDemandInterviewRoundsResult extends DemandRoundsSource {
  rounds: ConfiguredRound[];
  setRounds: (rounds: ConfiguredRound[]) => void;
  isLoading: boolean;
  /** True when the company's rounds fetch failed. The hook already falls back to an empty list
   *  (source: 'global') in this case — this is only for the caller to surface a toast. */
  isError: boolean;
  /** True once the user has manually edited the list (vs. it just being seeded/inherited). */
  touched: boolean;
}

/**
 * Resolves the interview rounds to seed a Demand Create/Edit form with, and tracks edits.
 *
 * Precedence mirrors resolveConfiguredRounds() on the server
 * (src/lib/demandFulfillment/interviewConfig.ts):
 *
 *   1. the demand's own explicit configuration  — highest; never overwritten
 *   2. the selected company's configured rounds  — inherited
 *   3. the global default rounds
 *
 * Selection rule that protects existing data (requirement: changing Company must not destroy a
 * demand's explicit configuration): rounds are re-seeded ONLY when the user actually changes
 * the Company, and even then an already-edited round list is kept unless the user is still on
 * the untouched inherited value. A demand with `hasConfig` true is never re-seeded.
 */
export function useDemandInterviewRounds({
  companyId,
  demandRounds,
  demandHasConfig,
  confirmReplace,
  preserveRoundsOnNextChange,
}: {
  companyId: string | null;
  preserveRoundsOnNextChange?: boolean;
  demandRounds: ConfiguredRound[];
  demandHasConfig: boolean;
  /**
   * Called when the Company changes after the user has manually edited the list, to ask before
   * discarding those edits. Returning true proceeds with re-seeding from the new Company/global
   * state; false (or omitting this prop) keeps the current list untouched.
   */
  confirmReplace?: () => boolean;
}): UseDemandInterviewRoundsResult {
  const [rounds, setRounds] = useState<ConfiguredRound[]>(demandRounds);
  const [source, setSource] = useState<DemandRoundsSource['source']>('none');
  const [prevCompanyId, setPrevCompanyId] = useState<string | null>(companyId);
  const [touched, setTouched] = useState(false);
  const blockedForPreserveRef = useRef<string | null>(null);

  // The demand's own configuration always wins and is never re-seeded.
  useEffect(() => {
    if (demandHasConfig) {
      setRounds(demandRounds);
      setSource('demand');
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandHasConfig]);

  const companyRoundsQuery = useQuery({
    queryKey: ['company-interview-rounds', companyId],
    queryFn: () => getCompanyInterviewRounds(companyId as string),
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    // Only react to an actual Company change — the same "compare previous value" approach the
    // rest of the codebase uses instead of a run-once ref, so React Strict Mode's double
    // invocation can't trigger a spurious re-seed.
    if (prevCompanyId === companyId) return;

    // One-shot preserve: a freshly-created (round-less) client is auto-selected. Its selection
    // must not clear / re-seed rounds the user already typed. Mark this company as blocked so
    // the rounds-loading effect also skips it, then return without touching rounds or touched.
    if (preserveRoundsOnNextChange) {
      blockedForPreserveRef.current = companyId;
      setPrevCompanyId(companyId);
      return;
    }
    blockedForPreserveRef.current = null;
    setPrevCompanyId(companyId);

    if (demandHasConfig) return; // explicit demand config is authoritative
    if (touched) {
      // The user already customised the list — ask before discarding those edits instead of
      // silently either clobbering or ignoring the Company change.
      if (!confirmReplace || !confirmReplace()) return;
      setTouched(false);
    }

    if (!companyId) {
      setRounds([]);
      setSource('global');
      return;
    }
    // Wait for the company's rounds; the effect re-runs when the query settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, prevCompanyId, demandHasConfig, touched, companyRoundsQuery.data, companyRoundsQuery.isLoading, preserveRoundsOnNextChange]);

  useEffect(() => {
    if (demandHasConfig) return;
    if (prevCompanyId !== companyId) return; // wait for the change to be observed above
    if (blockedForPreserveRef.current === companyId) return; // preserved: no rounds change
    if (touched) return; // the confirm above declined to replace the list
    if (!companyId) return;
    if (companyRoundsQuery.isLoading) return;

    // Inactive company rounds are never loaded into a NEW demand — only what is currently active.
    const companyRounds = (companyRoundsQuery.data?.rounds ?? []).filter((r) => r.isActive !== false);
    if (companyRounds.length > 0) {
      setRounds(companyRounds.map((r) => ({ round_id: r.round_id, name: r.name, mode: r.mode, order: r.order, mandatory: r.mandatory })));
      setSource('company');
    } else {
      // No company configuration -> fall through to the global default (server-side fallback
      // still applies if the global list is empty).
      setRounds([]);
      setSource('global');
    }
    // prevCompanyId MUST be a dependency, not just read above: when the user cancels and
    // reselects a company whose rounds react-query already has cached (fresh within
    // staleTime), the query serves that data instantly — `data` and `isLoading` never change
    // from their current values, so neither would re-trigger this effect on their own. Only
    // `prevCompanyId` catching up to `companyId` (committed one render after the effect above
    // calls setPrevCompanyId) changes in that case, so it has to be watched here too, or this
    // effect silently never re-applies the (cached) rounds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyRoundsQuery.data, companyRoundsQuery.isLoading, companyId, prevCompanyId]);

  const updateRounds = (next: ConfiguredRound[]) => {
    setTouched(true);
    setRounds(next);
  };

  return {
    rounds,
    setRounds: updateRounds,
    source,
    companyId,
    isLoading: companyRoundsQuery.isLoading,
    isError: companyRoundsQuery.isError,
    touched,
  };
}