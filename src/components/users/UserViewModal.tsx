'use client';

import { ReactNode } from 'react';
import { Profile } from '../types';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/badge';
import { USER_ROLE_OPTIONS } from '@/constants/options';
import { formatDate, formatScheduledDate } from '@/lib/utils';

interface UserViewModalProps {
  viewingUser: Profile;
  setViewingUser: (v: Profile | null) => void;
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[0.78rem] font-semibold text-[#475569]">{label}</div>
      <div className="text-[0.88rem] text-[#0f172a]">{value}</div>
    </div>
  );
}

export function UserViewModal({ viewingUser, setViewingUser }: UserViewModalProps) {
  const close = () => setViewingUser(null);
  const roleLabel = USER_ROLE_OPTIONS.find((r) => r.value === viewingUser.role)?.label || viewingUser.role;

  return (
    <Modal title={viewingUser.full_name} subtitle="Employee profile details" width="560px" onClose={close}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
          <DetailField label="First Name" value={viewingUser.first_name || viewingUser.full_name.split(' ')[0] || '—'} />
          <DetailField label="Last Name" value={viewingUser.last_name || viewingUser.full_name.split(' ').slice(1).join(' ') || '—'} />
          <DetailField label="Email" value={viewingUser.email} />
          <DetailField label="Phone Number" value={viewingUser.phone || '—'} />
          <DetailField
            label="Date of Joining"
            value={viewingUser.date_of_joining ? formatScheduledDate(viewingUser.date_of_joining) : '—'}
          />
          <DetailField label="Created At" value={formatDate(viewingUser.created_at)} />
          <DetailField
            label="Role"
            value={<Badge className="rounded border-transparent bg-[#eff6ff] text-[0.75rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]">{roleLabel}</Badge>}
          />
          <DetailField
            label="Status"
            value={
              <Badge className="rounded border-transparent bg-[#ecfdf5] text-[0.75rem] font-semibold text-[#10b981] hover:bg-[#ecfdf5]">
                {viewingUser.is_active ? 'Active' : 'Inactive'}
              </Badge>
            }
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={close}
            className="h-auto rounded-md border border-[#e2e8f0] bg-white px-4 py-2 text-[0.83rem] font-normal text-[#0f172a] hover:bg-[#f8fafc]"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
