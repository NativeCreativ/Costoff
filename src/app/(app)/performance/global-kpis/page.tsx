'use client';

import { usePerformanceQuery } from '@/queries/performance/usePerformanceQuery';
import { GlobalKpis } from '@/components/performance/GlobalKpis';

/** /performance/global-kpis */
export default function GlobalKpisPage() {
  const performanceQuery = usePerformanceQuery();
  const globalKpis = performanceQuery.data?.globalKpis ?? {};

  return <GlobalKpis globalKpis={globalKpis} />;
}
