"use client";

import { Offer } from "../types";
import { OfferRow } from "./OfferRow";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { TableEmpty } from "@/components/ui/TableEmpty";

const TABLE_COLUMNS = 6;

interface OffersTableProps {
  offers: Offer[];
  loadingOffers: boolean;
  deletingItem: {
    id: string;
    type: "demand" | "candidate" | "offer";
  } | null;
  openLifecycle: (reqId: string) => void;
  onDeleteRequest: (
    id: string,
    type: "demand" | "candidate" | "offer",
  ) => void;
  onDeleteCancel: () => void;
  handleDelete: (
    id: string,
    type: "demand" | "candidate" | "offer",
  ) => void;
}

export function OffersTable({
  offers,
  loadingOffers,
  deletingItem,
  openLifecycle,
  onDeleteRequest,
  onDeleteCancel,
  handleDelete,
}: OffersTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--card-border)] bg-white px-[22px] py-[18px]">
        <div className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]">
          <span>Offers Log</span>
          <Badge className="border-transparent bg-[#fee2e2] text-[0.72rem] font-bold text-[#ef4444] hover:bg-[#fee2e2]">
            {offers.length}
          </Badge>
        </div>
      </div>
      <div className="table-scroll">
        <table className="w-full text-left text-[0.83rem]">
          <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[0.75rem] font-bold uppercase tracking-[0.4px] text-[#475569]">
            <tr>
              <th className="px-4 py-3">Candidate & Demand</th>
              <th className="px-4 py-3">Offered CTC</th>
              <th className="px-4 py-3">Offer Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {loadingOffers ? (
              <TableSkeleton columns={TABLE_COLUMNS} padded />
            ) : offers.length === 0 ? (
              <TableEmpty colSpan={TABLE_COLUMNS}>
                No offers released yet or matching your status filter.
              </TableEmpty>
            ) : (
              offers.map((offer) => (
                <OfferRow
                  key={offer.id}
                  o={offer}
                  deletingItem={deletingItem}
                  openLifecycle={openLifecycle}
                  onDeleteRequest={onDeleteRequest}
                  onDeleteCancel={onDeleteCancel}
                  handleDelete={handleDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
