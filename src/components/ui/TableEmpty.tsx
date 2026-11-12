import type { ReactNode } from 'react';

export function TableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-0 p-0">
        <div className="table-empty">{children}</div>
      </td>
    </tr>
  );
}
