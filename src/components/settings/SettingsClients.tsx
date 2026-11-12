'use client';

import { ClientAccount } from '../types';
import { ClientsTable } from '@/components/ui/ClientsTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SettingsClientsProps {
  clients: ClientAccount[];
  setShowClientModal: (v: boolean) => void;
}

export function SettingsClients({ clients, setShowClientModal }: SettingsClientsProps) {
  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)] flex items-center justify-between px-5 py-4">
        <span className="text-[0.9rem] font-bold text-[#0f172a]">Clients Master Management</span>
        <Button onClick={() => setShowClientModal(true)} className="h-auto rounded-md px-3.5 py-2 text-[0.83rem] font-semibold">+ Add Client Account</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
        <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]"><div className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]"><span>Clients List</span><Badge className="border-transparent bg-[#fee2e2] text-[0.72rem] font-bold text-[#ef4444] hover:bg-[#fee2e2]">{clients.length}</Badge></div></div>
        <div>
          <ClientsTable clients={clients} />
        </div>
      </div>
    </>
  );
}
