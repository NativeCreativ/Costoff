'use client';

import { ClientAccount } from '../types';
import { ClientsTable } from '@/components/ui/ClientsTable';

interface ClientCrmProps {
  clients: ClientAccount[];
}

export function ClientCrm({ clients }: ClientCrmProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]"><h2 className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]"><i className="fa-solid fa-handshake mr-2"></i>Client CRM & Account Interaction History</h2></div>
      <div className="p-5">
        <ClientsTable clients={clients} nameHeader="Client Name" notesHeader="Account SLA & Notes" />
      </div>
    </div>
  );
}
