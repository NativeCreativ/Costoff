'use client';

import { ActivityLog } from '@/components/types';
import { Badge } from './badge';
import { formatDateTime } from '@/lib/utils';

interface ActivityLogTableProps {
  logs: ActivityLog[];
  highlightAction?: boolean;
}

export function ActivityLogTable({ logs, highlightAction }: ActivityLogTableProps) {
  return (
    <table className="data-table">
      <thead><tr><th>Action</th><th>Entity</th><th>Details</th><th>Performed By</th><th>Timestamp</th></tr></thead>
      <tbody>
        {logs.map(log => (
          <tr key={log.id}>
            <td className="font-semibold text-[#0f172a]" style={highlightAction ? { color: '#2563eb' } : undefined}>{log.action}</td>
            <td><Badge className="rounded border-transparent bg-[#eff6ff] text-[0.72rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]">{log.entity_type.toUpperCase()}</Badge></td>
            <td>{log.details}</td>
            <td className={highlightAction ? 'font-semibold text-[#0f172a]' : undefined}>{log.user_name}</td>
            <td>{formatDateTime(log.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
