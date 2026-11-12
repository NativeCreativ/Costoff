import { api } from '@/lib/axios';
import {
  DashboardData,
  KpiData,
  FunnelData,
  DemandStatusData,
  TrendData,
  AgingBucket,
  InterviewActivityDay,
  AttentionData,
  CompanyOverviewData,
  RecruiterPerformanceData,
  AmPerformanceData,
  SourceEffectivenessData,
} from '@/components/dashboard/dashboardTypes';

export interface DashboardResponse {
  kpis: KpiData;
  funnel: FunnelData;
  demandStatus: DemandStatusData;
  trend: TrendData;
  aging: AgingBucket[];
  interviewActivity: InterviewActivityDay[];
  attentionRequired: AttentionData;
  companyOverview: CompanyOverviewData | null;
  recruiterPerformance: RecruiterPerformanceData | null;
  amPerformance: AmPerformanceData | null;
  sourceEffectiveness: SourceEffectivenessData;
}

export async function getDashboardData(): Promise<DashboardResponse> {
  const { data } = await api.get('/dashboard');
  return data;
}