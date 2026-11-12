'use client';

import { usePerformanceQuery } from '@/queries/performance/usePerformanceQuery';
import { ClientAnalytics } from '@/components/performance/ClientAnalytics';

/** /performance/client-analytics */
export default function ClientAnalyticsPage() {
  const performanceQuery = usePerformanceQuery();
  const clientMetrics = performanceQuery.data?.clientMetrics ?? [];

  return <ClientAnalytics clientMetrics={clientMetrics} />;
}
