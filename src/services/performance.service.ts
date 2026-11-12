import { api } from '@/lib/axios';
import { TAMetric, AMMetric, ClientMetric, GlobalKpiState } from '@/components/types';

export interface PerformanceData {
  taMetrics: TAMetric[];
  amMetrics: AMMetric[];
  clientMetrics: ClientMetric[];
  globalKpis: GlobalKpiState;
}

export async function getPerformance(): Promise<PerformanceData> {
  const { data } = await api.get('/performance');
  return {
    taMetrics: data.taMetrics || [],
    amMetrics: data.amMetrics || [],
    clientMetrics: data.clientMetrics || [],
    globalKpis: data.globalKpis || {},
  };
}
