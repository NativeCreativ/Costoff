'use client';

import { Offer } from '../types';
import { InlineDeleteConfirm } from '@/components/ui/InlineDeleteConfirm';
import { Badge } from '@/components/ui/badge';
import { formatScheduledDate } from '@/lib/utils';

interface OfferRowProps {
  o: Offer;
  deletingItem: { id: string; type: 'demand' | 'candidate' | 'offer' } | null;
  openLifecycle: (reqId: string) => void;
  onDeleteRequest: (id: string, type: 'demand' | 'candidate' | 'offer') => void;
  onDeleteCancel: () => void;
  handleDelete: (id: string, type: 'demand' | 'candidate' | 'offer') => void;
}

export function OfferRow({ o, deletingItem, openLifecycle, onDeleteRequest, onDeleteCancel, handleDelete }: OfferRowProps) {
  return (
    <tr>
      <td className="font-semibold text-[#0f172a]">{o.candidates?.full_name || '—'}</td>
      <td>
        {o.demands?.request_id ? (
          <button
            onClick={() => openLifecycle(o.demands!.request_id)}
            title="Click to view full Requirement Lifecycle & Candidate History"
            className="cursor-pointer border-none bg-none p-0 text-left text-[0.83rem] font-bold text-[#2563eb] underline"
          >
            <i className="fa-solid fa-clock-rotate-left mr-1 text-[0.75rem]"></i>
            {o.demands.request_id}
          </button>
        ) : '—'} {o.demands?.skill_description ? `— ${o.demands.skill_description}` : ''}
      </td>
      <td>{o.offered_ctc ? `₹${o.offered_ctc}L` : '—'}</td>
      <td>{o.offer_date ? formatScheduledDate(o.offer_date) : '—'}</td>
      <td>
        <Badge className={`rounded border-transparent px-2 py-0.5 text-[0.72rem] font-semibold ${o.status === 'Accepted' ? 'bg-[#dcfce7] text-[#166534] hover:bg-[#dcfce7]' : o.status === 'Declined' ? 'bg-[#fee2e2] text-[#dc2626] hover:bg-[#fee2e2]' : 'bg-[#fef3c7] text-[#92400e] hover:bg-[#fef3c7]'}`}>
          {o.status}
        </Badge>
      </td>
      <td>
        <InlineDeleteConfirm
          isConfirming={deletingItem?.id === o.id}
          onDeleteRequest={() => onDeleteRequest(o.id, 'offer')}
          onConfirm={() => handleDelete(o.id, 'offer')}
          onCancel={onDeleteCancel}
          label="Delete Offer Record"
        />
      </td>
    </tr>
  );
}
