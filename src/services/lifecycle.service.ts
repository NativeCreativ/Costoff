import { api } from '@/lib/axios';

export async function getRequirementLifecycle(requestId: string): Promise<any> {
  const { data } = await api.get(`/demands/${encodeURIComponent(requestId)}/lifecycle`);
  return data;
}

export async function batchAssignCandidates(demandId: string, candidateIds: string[]): Promise<void> {
  await api.post('/submissions', {
    demand_id: demandId,
    candidate_ids: candidateIds,
    stage: 'phone_call_done',
  });
}

export async function updateSubmissionStage(submissionId: string, stage: string): Promise<void> {
  await api.put('/submissions', { id: submissionId, stage });
}

export async function getRepoCandidates(): Promise<any[]> {
  const { data } = await api.get('/candidates');
  return data.candidates || [];
}
