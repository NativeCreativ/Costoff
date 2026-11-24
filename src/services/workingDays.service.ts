import { api } from '@/lib/axios';

export interface WorkingDayMonth {
  id: string | null;
  year: number;
  month: number;
  working_days: number;
  holidays_count: number;
  notes: string;
}

export interface WorkingDaysResponse {
  year: number;
  months: WorkingDayMonth[];
}

export interface SaveWorkingDayInput {
  year: number;
  month: number;
  working_days: number;
  holidays_count?: number;
  notes?: string;
}

export async function getWorkingDays(year: number): Promise<WorkingDaysResponse> {
  const { data } = await api.get('/admin/settings/working-days', {
    params: { year },
  });
  return data;
}

export async function saveWorkingDay(input: SaveWorkingDayInput): Promise<{ success: boolean; record: WorkingDayMonth }> {
  const { data } = await api.post('/admin/settings/working-days', input);
  return data;
}
