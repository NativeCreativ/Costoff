'use client';

import { useNamedMasterQuery } from '@/queries/masterData/useMasterData';
import { INTERVIEW_STATUS_OPTIONS, INTERVIEW_STATUS_TRANSITION_OPTIONS } from '@/constants/options';

/**
 * Selection and interview dropdowns. Falls back to the historical list while the
 * master is loading or before the migration has been applied.
 */
export function useInterviewStatusOptions() {
  const query = useNamedMasterQuery('interview-statuses');
  const rows = query.data ?? [];
  const fromMaster = rows.length > 0;
  const all = fromMaster
    ? rows.map((row) => ({ value: row.name, label: row.name }))
    : INTERVIEW_STATUS_OPTIONS;
  const transition = fromMaster
    ? rows.filter((row) => row.is_transition !== false).map((row) => ({ value: row.name, label: row.name }))
    : INTERVIEW_STATUS_TRANSITION_OPTIONS;
  return { all, transition, isLoading: query.isLoading };
}
