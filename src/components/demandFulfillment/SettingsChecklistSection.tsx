'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/Toast';
import { SettingsItemRowActions } from '@/components/interviewRounds/SettingsItemRowActions';
import { useUpdateSuperAdminSettingsMutation } from '@/queries/demandFulfillment/useDemandFulfillmentMutations';
import type { SuperAdminSettingsPatch } from '@/components/types';

interface ChecklistItem {
  name: string;
  required: boolean;
  isActive: boolean;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

interface SettingsChecklistSectionProps {
  /** Current list, read from the settings GET cache by the thin per-field wrapper (Interview
   *  Modes / Onboarding Document Checklist / BGV Checklist) that renders this component. */
  items: ChecklistItem[];
  withRequiredCheckbox?: boolean;
  /** Blocks deleting the last item (used by Interview Modes only — at least one is required). */
  minOne?: boolean;
  /** Last-active guard tooltip (Interview Modes only): shown on the switch of the final active
   *  item. The backend enforces it with a 409; this is the pre-emptive hint. */
  lastActiveMessage?: string;
  addPlaceholder: string;
  /** Singular noun for error/validation copy, e.g. "interview mode", "document". */
  itemLabel: string;
  /** Shapes the saved list back into the one `SuperAdminSettingsPatch` field this editor owns. */
  toPayload: (items: ChecklistItem[]) => SuperAdminSettingsPatch;
  /** Called when the Active/Inactive switch is toggled. The parent owns the save call. */
  onToggleItem?: (item: ChecklistItem) => void;
  /** Whether a toggle request is in flight (disables the switch). */
  togglePending?: boolean;
}

/**
 * Add/rename/delete/reorder editor shared by Interview Modes, Onboarding Document Checklist and
 * BGV Checklist — each of those is a thin wrapper passing its own `items`/`toPayload`. Every
 * action here calls the API immediately (one `PUT .../demand-fulfillment` with just that field);
 * there is no local "unsaved" copy beyond the optimistic value held during that one request.
 *
 * Validation (trim, non-empty, case-insensitive duplicate) runs BEFORE the request and blocks it
 * entirely on failure — the error renders inline and the list is left exactly as it was, the same
 * way `SkillsSelector` rejects a bad entry without touching `value`.
 */
export function SettingsChecklistSection({ items, withRequiredCheckbox, minOne, lastActiveMessage, addPlaceholder, itemLabel, toPayload, onToggleItem, togglePending = false }: SettingsChecklistSectionProps) {
  const toast = useToast();
  const mutation = useUpdateSuperAdminSettingsMutation();

  const [localItems, setLocalItems] = useState<ChecklistItem[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current = localItems ?? items;

  function save(next: ChecklistItem[]) {
    setLocalItems(next);
    mutation.mutate(toPayload(next), {
      onSuccess: () => toast.success('Saved'),
      onError: (err) => {
        const message = isAxiosError(err) ? err.response?.data?.error || `Failed to save the ${itemLabel}` : `Failed to save the ${itemLabel}`;
        setError(message);
        toast.error('Save failed', message);
      },
      // Clears the optimistic copy either way: on success the cache is already fresh (the
      // invalidate above is awaited first), on failure nothing was invalidated so falling back to
      // `items` reverts the control to its last-saved value.
      onSettled: () => setLocalItems(null),
    });
  }

  const commitAdd = () => {
    const name = newName.trim();
    if (!name) {
      setError(`Enter a ${itemLabel} name`);
      return;
    }
    if (current.some((i) => sameName(i.name, name))) {
      setError(`"${name}" is already in this list`);
      return;
    }
    setError(null);
    setNewName('');
    save([...current, { name, required: true, isActive: true }]);
  };

  const commitRename = (index: number) => {
    const name = editValue.trim();
    setEditingIndex(null);
    const existing = current[index];
    if (!existing || !name || sameName(existing.name, name)) return;
    if (current.some((i, idx) => idx !== index && sameName(i.name, name))) {
      setError(`"${name}" is already in this list`);
      return;
    }
    setError(null);
    save(current.map((it, idx) => (idx === index ? { ...it, name } : it)));
  };

  const toggleRequired = (index: number) => {
    save(current.map((it, idx) => (idx === index ? { ...it, required: !it.required } : it)));
  };

  const handleDelete = (index: number) => {
    if (minOne && current.length <= 1) {
      setError(`At least one ${itemLabel} is required`);
      return;
    }
    setError(null);
    save(current.filter((_, idx) => idx !== index));
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...current];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    save(next);
  };

  return (
    <div>
      {current.length === 0 ? (
        <div className="mb-2 rounded-md border border-dashed border-[#e2e8f0] p-4 text-center text-[0.8rem] text-[#94a3b8]">Nothing configured yet.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {current.map((item, idx) => (
            <div
              key={idx}
              draggable={editingIndex !== idx}
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(idx)}
              className={`flex h-9 items-center gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 ${item.isActive === false ? 'opacity-60' : ''}`}
            >
              <span className="w-5 shrink-0 text-[0.75rem] font-bold text-[#2563eb]">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                {editingIndex === idx ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitRename(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename(idx);
                      } else if (e.key === 'Escape') {
                        setEditingIndex(null);
                      }
                    }}
                    className="h-7 w-full truncate rounded border border-[#cbd5e1] bg-white px-1 text-[0.83rem] outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setError(null); setEditingIndex(idx); setEditValue(item.name); }}
                    title={item.name}
                    disabled={mutation.isPending}
                    className="h-7 w-full truncate rounded border border-transparent bg-transparent px-1 text-left text-[0.83rem] outline-none hover:bg-[#f1f5f9] disabled:cursor-not-allowed"
                  >
                    {item.name}
                  </button>
                )}
              </div>
              {withRequiredCheckbox && (
                <label className="flex shrink-0 items-center gap-1 text-[#0.72rem] text-[#475569]">
                  <input type="checkbox" checked={item.required} disabled={mutation.isPending} onChange={() => toggleRequired(idx)} />
                  Required
                </label>
              )}
              <SettingsItemRowActions
                name={item.name}
                isActive={item.isActive !== false}
                onEdit={() => { setError(null); setEditingIndex(idx); setEditValue(item.name); }}
                onDelete={() => handleDelete(idx)}
                onToggle={onToggleItem ? () => onToggleItem(item) : undefined}
                disabled={mutation.isPending}
                pending={togglePending}
                // Last-active guard: only the final ACTIVE row is blocked, and only when this
                // list actually enforces one (Interview Modes).
                toggleBlockedMessage={
                  lastActiveMessage && item.isActive !== false && current.filter((i) => i.isActive !== false).length <= 1
                    ? lastActiveMessage
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => { setNewName(e.target.value); if (error) setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitAdd(); } }}
          placeholder={addPlaceholder}
          disabled={mutation.isPending}
          className="h-auto flex-1 rounded-md border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[0.83rem] shadow-none"
        />
        <Button size="sm" variant="outline" onClick={commitAdd} disabled={mutation.isPending} className="h-auto shrink-0 gap-1.5 px-2.5 py-1.5">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {error && <div className="mt-2 rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{error}</div>}
    </div>
  );
}
