'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn, formatScheduledDate } from '@/lib/utils';
import { useTodosQuery } from '@/queries/teamWork/useTodos';
import { DashboardCard } from './DashboardCard';

const PRIORITY_CLASSES: Record<string, string> = {
  High: 'bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fef2f2]',
  Medium: 'bg-[#fffbeb] text-[#92400e] hover:bg-[#fffbeb]',
  Low: 'bg-[#f1f5f9] text-[#475569] hover:bg-[#f1f5f9]',
};

/** Org Overview: today's published To-Do items, so everyone sees the team priorities. */
export function TeamTodoCard() {
  const query = useTodosQuery('active');
  const open = (query.data?.data ?? []).filter((item) => item.status !== 'done');
  const shown = open.slice(0, 5);

  return (
    <DashboardCard
      title="Team To-Do"
      subtitle="Priority items active today"
      right={<Link href="/todo" className="text-[13px] font-semibold text-[#2563eb] hover:underline">View all</Link>}
      state={query.isLoading ? 'loading' : query.isError ? 'error' : 'ready'}
      empty={open.length === 0}
      emptyMessage="Nothing on the To-Do list today."
      emptyIcon="fa-list-ul"
    >
      <ul className="flex flex-col divide-y divide-[#f1f5f9]">
        {shown.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-[0.85rem] font-semibold text-[#0f172a]">{item.title}</div>
              <div className="text-[0.72rem] text-[#64748b]">
                until {formatScheduledDate(item.active_until)}
                {item.created_by_name ? ` · ${item.created_by_name}` : ''}
              </div>
            </div>
            <Badge className={cn('shrink-0 border-transparent text-[0.68rem] font-semibold', PRIORITY_CLASSES[item.priority] ?? PRIORITY_CLASSES.Low)}>
              {item.priority}
            </Badge>
          </li>
        ))}
      </ul>
      {open.length > shown.length && (
        <Link href="/todo" className="mt-1 block text-[0.75rem] font-semibold text-[#2563eb] hover:underline">
          +{open.length - shown.length} more
        </Link>
      )}
    </DashboardCard>
  );
}
