'use client';

import { Onboarding, BGV_COLORS } from '../types';
import { Badge } from '@/components/ui/badge';
import { formatScheduledDate } from '@/lib/utils';

interface OnboardingRowProps {
  ob: Onboarding;
  openLifecycle: (reqId: string) => void;
}

export function OnboardingRow({ ob, openLifecycle }: OnboardingRowProps) {
  const bgvColor = BGV_COLORS[ob.bgv_status] || BGV_COLORS['in_progress'];
  return (
    <tr>
      <td className="font-semibold text-[#0f172a]">{ob.candidates?.full_name || '—'}</td>
      <td>
        {ob.demands?.request_id ? (
          <button
            onClick={() => openLifecycle(ob.demands!.request_id)}
            title="Click to view full Requirement Lifecycle & Candidate History"
            className="cursor-pointer border-none bg-none p-0 text-left text-[0.83rem] font-bold text-[#2563eb] underline"
          >
            <i className="fa-solid fa-clock-rotate-left mr-1 text-[0.75rem]"></i>
            {ob.demands.request_id}
          </button>
        ) : '—'} {ob.demands?.skill_description ? `— ${ob.demands.skill_description}` : ''}
      </td>
      <td>
        <Badge className="rounded border-transparent px-2 py-0.5 text-[0.72rem] font-semibold hover:opacity-100" style={{ backgroundColor: bgvColor.bg, color: bgvColor.text }}>
          {ob.bgv_status.toUpperCase()}
        </Badge>
      </td>
      <td>{ob.actual_joining_date ? formatScheduledDate(ob.actual_joining_date) : 'TBD'}</td>
      <td>
        <Badge className={`rounded border-transparent px-2 py-0.5 text-[0.72rem] font-semibold ${ob.status === 'onboarded' ? 'bg-[#dcfce7] text-[#166534] hover:bg-[#dcfce7]' : 'bg-[#fef3c7] text-[#92400e] hover:bg-[#fef3c7]'}`}>
          {ob.status}
        </Badge>
      </td>
    </tr>
  );
}
