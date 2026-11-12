import { api } from '@/lib/axios';

/** A master interview round, as returned by GET /api/interview-rounds. */
export interface InterviewRoundMaster {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}


export interface ConfiguredRound {
  round_id?: string | null;
  /**
   * The materialized `demand_interview_rounds.id` this entry continues, or `null` for a round that
   * does not exist in the DB yet. Demand-only: the configurator spreads it through reorder,
   * Mandatory toggles and renames, and a newly added round simply has none. It is what lets the
   * backend tell "deleted" apart from "renamed" without matching on a user-typed name.
   */
  row_id?: string | null;
  name: string;
  /** Optional free-text interview mode for this round. NULL/blank = not recorded. */
  mode?: string | null;
  order: number;
  mandatory?: boolean;
  isActive?: boolean;
  /** 'company' variant only: how many of this company's own demands (or a candidate interview)
   *  already use this round — read-only, populated from GET/PUT .../interview-rounds. */
  usage?: number;
}

export async function findOrCreateInterviewRound(name: string): Promise<{ round: InterviewRoundMaster; created: boolean }> {
  const { data } = await api.post('/interview-rounds', { name });
  return { round: data.round, created: !!data.created };
}