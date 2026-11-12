'use client';

import { usePerformanceQuery } from '@/queries/performance/usePerformanceQuery';
import { AmPerformance } from '@/components/performance/AmPerformance';

/** /performance/account-managers */
export default function AmPerformancePage() {
  const performanceQuery = usePerformanceQuery();
  const amMetrics = performanceQuery.data?.amMetrics ?? [];

  return <AmPerformance amMetrics={amMetrics} />;
}
