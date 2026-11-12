'use client';

import { ClientAccount } from '@/components/types';

interface ClientsTableProps {
  clients: ClientAccount[];
  nameHeader?: string;
  notesHeader?: string;
}

export function ClientsTable({ clients, nameHeader = 'Client Account Name', notesHeader = 'SLA & Account Notes' }: ClientsTableProps) {
  return (
    <table className="data-table">
      <thead><tr><th>{nameHeader}</th><th>Industry</th><th>Location</th><th>{notesHeader}</th></tr></thead>
      <tbody>
        {clients.map(c => (
          <tr key={c.id}>
            <td className="font-semibold text-[#0f172a]">{c.name}</td><td>{c.industry}</td><td>{c.location}</td><td>{c.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
