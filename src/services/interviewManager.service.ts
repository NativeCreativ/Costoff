import { api } from '@/lib/axios';

export interface InterviewHistoryAttempt {
  id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
  reason: string | null;
  custom_reason: string | null;
  comments: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface InterviewManagerRound {
  id?: string;
  round_order: number;
  round_name: string;
  interview_type: 'Technical' | 'Functional' | 'Managerial';
  scheduled_date: string | null;
  scheduled_time: string | null;
  mode: 'Virtual' | 'Telephonic' | 'In-Person';
  medium: 'Teams Meeting' | 'Slack Meeting' | 'Direct_Call' | 'Zoom_Meeting';
  status: 'Scheduled' | 'Completed' | 'Rescheduled' | 'Cancelled';
  result?: 'Selected' | 'Rejected' | 'Feedback Awaiting' | 'Onhold' | null;
  reason?: 'Candidate_No_Show' | 'Panel_No_Show' | 'Candidate_Not_Available' | 'Client_No_Show' | 'Others' | null;
  custom_reason?: string | null;
  reject_reason?: string | null;
  comments?: string | null;
  created_by_name?: string | null;
  created_at?: string;
  history?: InterviewHistoryAttempt[];
}

export interface InterviewManagerResponse {
  success: boolean;
  candidate: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
  submission: {
    id: string;
    current_status: string;
    final_result: string | null;
    is_active: boolean;
  };
  demand: {
    id: string;
    request_id: string;
    status: string;
  };
  templateRounds: Array<{
    id: string;
    name: string;
    round_order: number;
    mode: string | null;
  }>;
  interviews: InterviewManagerRound[];
  hasRejection: boolean;
}

export interface SaveInterviewRoundPayload {
  action: 'save_round' | 'add_round' | 'delete_round';
  interview_id?: string;
  round_order: number;
  round_name: string;
  interview_type: 'Technical' | 'Functional' | 'Managerial';
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  mode: 'Virtual' | 'Telephonic' | 'In-Person';
  medium: 'Teams Meeting' | 'Slack Meeting' | 'Direct_Call' | 'Zoom_Meeting';
  status: 'Scheduled' | 'Completed' | 'Rescheduled' | 'Cancelled';
  result?: 'Selected' | 'Rejected' | 'Feedback Awaiting' | 'Onhold' | null;
  reason?: 'Candidate_No_Show' | 'Panel_No_Show' | 'Candidate_Not_Available' | 'Client_No_Show' | 'Others' | null;
  custom_reason?: string | null;
  reject_reason?: string | null;
  comments?: string | null;
  reschedule_date?: string | null;
  reschedule_time?: string | null;
}

export async function getCandidateInterviews(requestId: string, dcId: string): Promise<InterviewManagerResponse> {
  const { data } = await api.get(`/demands/${requestId}/candidates/${dcId}/interview-manager`);
  return data;
}

export async function saveInterviewRound(
  requestId: string,
  dcId: string,
  payload: SaveInterviewRoundPayload
): Promise<{ success: boolean; interview?: any; message?: string }> {
  const { data } = await api.post(`/demands/${requestId}/candidates/${dcId}/interview-manager`, payload);
  return data;
}
