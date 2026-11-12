import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getCandidateHistory } from '@/services/candidate.service';

export function useCandidateHistoryQuery(candidateId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.candidateHistory(candidateId || ''),
    queryFn: () => getCandidateHistory(candidateId as string),
    enabled: enabled && !!candidateId,
  });
}
