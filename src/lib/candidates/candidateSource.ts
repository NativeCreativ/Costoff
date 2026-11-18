// Rule: picking an existing candidate prefills the pipeline entry's Source with that
// candidate's own saved source. The vocabularies are now unified, so this is identity.

import type { UnifiedSource } from '@/lib/demandFulfillment/constants';

/** Identity mapping — candidate source values now match pipeline source values exactly. */
const CANDIDATE_TO_SUBMISSION_SOURCE: Record<string, UnifiedSource> = {
  naukri: 'naukri',
  linkedin: 'linkedin',
  indeed: 'indeed',
  direct: 'direct',
  referral: 'referral',
  headhunt: 'headhunt',
  database: 'database',
  others: 'others',
};

/** Null when the candidate has no (or an unrecognised) source — the caller keeps its default. */
export function submissionSourceForCandidate(candidateSource: string | null | undefined): UnifiedSource | null {
  if (!candidateSource) return null;
  return CANDIDATE_TO_SUBMISSION_SOURCE[candidateSource.trim().toLowerCase()] ?? null;
}