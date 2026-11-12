'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { GripVertical, Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/Toast';
import { SettingsItemRowActions } from '@/components/interviewRounds/SettingsItemRowActions';
import { useCompensationCurrenciesQueryIncludeInactive } from '@/queries/settings/useCompensationMastersQueries';
import {
  useCreateCompensationCurrencyMutation,
  useUpdateCompensationCurrencyMutation,
  useDeleteCompensationCurrencyMutation,
  useReorderCompensationCurrenciesMutation,
  useToggleCompensationCurrencyMutation,
} from '@/queries/settings/useCompensationMastersMutations';
import type { CompensationCurrency } from '@/components/types';

interface DraftFields {
  code: string;
  name: string;
  symbol: string;
}

const EMPTY_DRAFT: DraftFields = { code: '', name: '', symbol: '' };

/** Currency master (Demand Fulfillment Settings) — compact table (Code / Name / Symbol)
 *  with the shared row actions (pencil, trash, Active/Inactive switch). In-use items show
 *  a tooltip and have edit/delete disabled; the toggle stays enabled. */
export function CompensationCurrenciesSection() {
  const currenciesQuery = useCompensationCurrenciesQueryIncludeInactive();
  const createMutation = useCreateCompensationCurrencyMutation();
  const updateMutation = useUpdateCompensationCurrencyMutation();
  const deleteMutation = useDeleteCompensationCurrencyMutation();
  const reorderMutation = useReorderCompensationCurrenciesMutation();
  const toggleMutation = useToggleCompensationCurrencyMutation();
  const toast = useToast();

  const [addDraft, setAddDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<CompensationCurrency[] | null>(null);

  const currencies = localOrder ?? currenciesQuery.data ?? [];

  const startEdit = (c: CompensationCurrency) => {
    setError(null);
    setEditingId(c.id);
    setEditDraft({ code: c.code, name: c.name, symbol: c.symbol });
  };
  const cancelEdit = () => setEditingId(null);

  const saveAdd = () => {
    setError(null);
    if (!addDraft.code.trim() || !addDraft.name.trim() || !addDraft.symbol.trim()) {
      setError('Code, Name and Symbol are all required');
      return;
    }
    createMutation.mutate(addDraft, {
      onSuccess: () => {
        setAddDraft(EMPTY_DRAFT);
        toast.success('Currency added');
      },
      onError: (err) => {
        const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to create currency' : 'Failed to create currency';
        setError(message);
        toast.error('Create failed', message);
      },
    });
  };

  const saveEdit = (id: string) => {
    setError(null);
    if (!editDraft.code.trim() || !editDraft.name.trim() || !editDraft.symbol.trim()) {
      setError('Code, Name and Symbol are all required');
      return;
    }
    updateMutation.mutate(
      { id, payload: editDraft },
      {
        onSuccess: () => {
          setEditingId(null);
          toast.success('Currency updated');
        },
        onError: (err) => {
          const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to update currency' : 'Failed to update currency';
          setError(message);
          toast.error('Update failed', message);
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    setError(null);
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Currency deleted'),
      onError: (err) => {
        const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to delete currency' : 'Failed to delete currency';
        setError(message);
        toast.error('Delete failed', message);
      },
    });
  };

  const handleToggle = (c: CompensationCurrency) => {
    const nextIsActive = !c.is_active;
    toggleMutation.mutate(
      { id: c.id, isActive: nextIsActive },
      {
        onSuccess: () => {
          toast.success(nextIsActive ? 'Currency activated' : 'Currency deactivated');
        },
        onError: (err) => {
          const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to toggle currency' : 'Failed to toggle currency';
          setError(message);
          toast.error('Toggle failed', message);
        },
      }
    );
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const current = currencies;
    const from = current.findIndex((c) => c.id === dragId);
    const to = current.findIndex((c) => c.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setLocalOrder(next);
    setDragId(null);
    reorderMutation.mutate(
      next.map((c) => c.id),
      {
        onSuccess: () => toast.success('Order saved'),
        onSettled: () => setLocalOrder(null),
      }
    );
  };

  if (currenciesQuery.isLoading) {
    return <Loader message="Loading currencies…" size="sm" className="p-4" />;
  }

  const cellClass = 'h-auto rounded border-[#e2e8f0] bg-white px-2 py-1 text-[0.82rem] shadow-none';

  return (
    <div>
      {currencies.length === 0 ? (
        <div className="mb-2 rounded-md border border-dashed border-[#e2e8f0] p-4 text-center text-[0.8rem] text-[#94a3b8]">Nothing configured yet.</div>
      ) : (
        <div className="overflow-hidden rounded-md border border-[#e2e8f0]">
          <div className="grid grid-cols-[20px_90px_1fr_70px_100px] items-center gap-2 bg-[#f1f5f9] px-2.5 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">
            <span />
            <span>Code</span>
            <span>Name</span>
            <span>Symbol</span>
            <span />
          </div>
          <div className="flex flex-col divide-y divide-[#e2e8f0]">
            {currencies.map((c) => {
              const usageCount = c.usage?.demands ?? 0;
              const inUseMessage = usageCount > 0
                ? `In use (${usageCount} demands). Rename and delete are disabled. Use Deactivate to stop new use.`
                : undefined;
              return (
                <div
                  key={c.id}
                  draggable={editingId !== c.id}
                  onDragStart={() => setDragId(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(c.id)}
                  className={`grid h-9 grid-cols-[20px_90px_1fr_70px_100px] items-center gap-2 px-2.5 ${c.is_active ? '' : 'opacity-60'}`}
                >
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#cbd5e1]" />
                  {editingId === c.id ? (
                    <>
                      <Input value={editDraft.code} onChange={(e) => setEditDraft((d) => ({ ...d, code: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(c.id); } else if (e.key === 'Escape') cancelEdit(); }} placeholder="Code" className={cellClass} />
                      <Input value={editDraft.name} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(c.id); } else if (e.key === 'Escape') cancelEdit(); }} placeholder="Name" className={cellClass} />
                      <Input value={editDraft.symbol} onChange={(e) => setEditDraft((d) => ({ ...d, symbol: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(c.id); } else if (e.key === 'Escape') cancelEdit(); }} placeholder="Symbol" className={cellClass} />
                      <span className="flex shrink-0 items-center gap-1.5">
                        <button onClick={() => saveEdit(c.id)} disabled={updateMutation.isPending} className="text-[#16a34a] hover:text-[#15803d]"><Check className="h-4 w-4" /></button>
                        <button onClick={cancelEdit} className="text-[#94a3b8] hover:text-[#475569]"><X className="h-4 w-4" /></button>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="truncate font-mono text-[0.82rem] font-semibold text-[#0f172a]" title={c.code}>{c.code}</span>
                      <span className="truncate text-[0.82rem] text-[#334155]" title={c.name}>{c.name}</span>
                      <span className="truncate text-[0.82rem] text-[#64748b]" title={c.symbol}>{c.symbol}</span>
                      <SettingsItemRowActions
                        name={c.name}
                        isActive={c.is_active}
                        onEdit={() => startEdit(c)}
                        onDelete={() => handleDelete(c.id)}
                        onToggle={() => handleToggle(c)}
                        disabled={deleteMutation.isPending || updateMutation.isPending}
                        pending={toggleMutation.isPending}
                        lockedMessage={inUseMessage}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Input value={addDraft.code} onChange={(e) => setAddDraft((d) => ({ ...d, code: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveAdd(); } }} placeholder="Code (e.g. GBP)" className="h-auto w-24 rounded-md border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[0.83rem] shadow-none" />
        <Input value={addDraft.name} onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveAdd(); } }} placeholder="Name (e.g. British Pound)" className="h-auto flex-1 rounded-md border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[0.83rem] shadow-none" />
        <Input value={addDraft.symbol} onChange={(e) => setAddDraft((d) => ({ ...d, symbol: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveAdd(); } }} placeholder="Symbol (e.g. £)" className="h-auto w-20 rounded-md border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[0.83rem] shadow-none" />
        <Button size="sm" variant="outline" onClick={saveAdd} disabled={createMutation.isPending} className="h-auto shrink-0 gap-1.5 px-2.5 py-1.5">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {error && <div className="mt-2 rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{error}</div>}
    </div>
  );
}
