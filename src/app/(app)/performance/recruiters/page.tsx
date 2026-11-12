'use client';

import { usePerformanceQuery } from '@/queries/performance/usePerformanceQuery';
import { RecruiterPerformance } from '@/components/performance/RecruiterPerformance';

/** /performance/recruiters — target of the "View Full Report" button on /org-overview. */
export default function RecruiterPerformancePage() {
  const performanceQuery = usePerformanceQuery();
  const taMetrics = performanceQuery.data?.taMetrics ?? [];

  return <RecruiterPerformance taMetrics={taMetrics} />;
}
