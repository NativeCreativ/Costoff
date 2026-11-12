'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormSelect } from '@/components/ui/FormSelect';
import { useBulkChangeDemandStatusMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import { ALL_DEMAND_STATUS_VALUES } from '@/lib/demandFulfillment/constants';
import type { BulkStatusResult } from '@/services/demandFulfillment.service';

interface BulkDemandStatusModalProps {
  demandIds: string[];
  demandLabels: Record<string, string>;
  onClose: () => void;
  onDone: () => void;
}

const MIN_REMARK_LENGTH = 10;

export function BulkDemandStatusModal({ demandIds, demandLabels, onClose, onDone }: BulkDemandStatusModalProps) {
  const [toStatus, setToStatus] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkStatusResult | null>(null);

  const mutation = useBulkChangeDemandStatusMutation();

  const trimmedRemark = remark.trim();
  const isFormValid = !!toStatus && trimmedRemark.length >= MIN_REMARK_LENGTH;

  const handleSubmit = () => {
    setError(null);
    if (!isFormValid) return;
    mutation.mutate(
      { demandIds, to_status: toStatus, remark: trimmedRemark },
      {
        onSuccess: (res) => setResult(res),
        onError: (err) => setError(isAxiosError(err) ? err.response?.data?.error || 'Bulk update failed' : 'Bulk update failed'),
      }
    );
  };

  return (
    <Modal title={`Bulk Change Status (${demandIds.length} demand${demandIds.length > 1 ? 's' : ''})`} onClose={result ? onDone : onClose}>
      {result ? (
        <div className="flex flex-col gap-3">
          <div className="text-[0.85rem] font-semibold text-[#0f172a]">
            {result.successCount} succeeded, {result.failureCount} failed.
          </div>
          <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {result.results.map((r) => (
              <div key={r.demand_id} className="flex items-center justify-between rounded-md border border-[#e2e8f0] px-3 py-2 text-[0.8rem]">
                <span>{r.request_id || demandLabels[r.demand_id] || r.demand_id}</span>
                {r.success ? (
                  <Badge className="border-transparent bg-[#dcfce7] text-[0.7rem] font-semibold text-[#166534] hover:bg-[#dcfce7]">Updated</Badge>
                ) : (
                  <span className="text-[0.72rem] text-[#dc2626]">{r.error}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={onDone}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 text-[0.8rem] font-semibold text-[#475569]">Demands selected</div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2">
              {demandIds.map((id) => (
                <Badge key={id} className="border-transparent bg-white text-[0.7rem] font-semibold text-[#475569] hover:bg-white">
                  {demandLabels[id] || id}
                </Badge>
              ))}
            </div>
          </div>

          <FormSelect
            label="New Status"
            required
            placeholder="Select status…"
            options={ALL_DEMAND_STATUS_VALUES.map((s) => ({ value: s, label: s }))}
            value={toStatus}
            onChange={setToStatus}
          />

          <div>
            <label className="mb-1 block text-[0.8rem] font-semibold text-[#dc2626]">Remark *</label>
            <Textarea
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. Client put hiring on hold for this quarter; pausing sourcing until further notice."
              className="w-full resize-y rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
            />
            <div className={`mt-1 text-[0.72rem] ${trimmedRemark.length >= MIN_REMARK_LENGTH ? 'text-[#94a3b8]' : 'text-[#dc2626]'}`}>
              {trimmedRemark.length}/{MIN_REMARK_LENGTH} characters minimum
            </div>
          </div>

          {error && <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{error}</div>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!isFormValid || mutation.isPending}>{mutation.isPending ? 'Applying…' : 'Apply to All'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
