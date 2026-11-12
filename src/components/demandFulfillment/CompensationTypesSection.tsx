'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { GripVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/Toast';
import { SettingsItemRowActions } from '@/components/interviewRounds/SettingsItemRowActions';
import { useCompensationTypesQueryIncludeInactive } from '@/queries/settings/useCompensationMastersQueries';
import {
  useCreateCompensationTypeMutation,
  useUpdateCompensationTypeMutation,
  useDeleteCompensationTypeMutation,
  useReorderCompensationTypesMutation,
  useToggleCompensationTypeMutation,
} from '@/queries/settings/useCompensationMastersMutations';
import type { CompensationType } from '@/components/types';

/** Compensation Type (frequency) master — Hourly/Weekly/Monthly/etc. Uses the shared
 *  row actions (pencil, trash, Active/Inactive switch). In-use items show a tooltip
 *  and have edit/delete disabled; the toggle stays enabled. */
export function CompensationTypesSection() {
  const typesQuery = useCompensationTypesQueryIncludeInactive();
  const createMutation = useCreateCompensationTypeMutation();
  const updateMutation = useUpdateCompensationTypeMutation();
  const deleteMutation = useDeleteCompensationTypeMutation();
  const reorderMutation = useReorderCompensationTypesMutation();
  const toggleMutation = useToggleCompensationTypeMutation();
  const toast = useToast();

  const [addName, setAddName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<CompensationType[] | null>(null);

  const types = localOrder ?? typesQuery.data ?? [];

  const commitEdit = (id: string) => {
    const name = editName.trim();
    setEditingId(null);
    const current = types.find((t) => t.id === id);
    if (!name || !current || current.name === name) return;
    setError(null);
    updateMutation.mutate(
      { id, payload: { name } },
      {
        onSuccess: () => toast.success('Compensation type updated'),
        onError: (err) => {
          const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to update compensation type' : 'Failed to update compensation type';
          setError(message);
          toast.error('Update failed', message);
        },
      }
    );
  };

  const saveAdd = () => {
    setError(null);
    if (!addName.trim()) {
      setError('Name is required');
      return;
    }
    createMutation.mutate(
      { name: addName.trim() },
      {
        onSuccess: () => {
          setAddName('');
          toast.success('Compensation type added');
        },
        onError: (err) => {
          const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to create compensation type' : 'Failed to create compensation type';
          setError(message);
          toast.error('Create failed', message);
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    setError(null);
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Compensation type deleted'),
      onError: (err) => {
        const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to delete compensation type' : 'Failed to delete compensation type';
        setError(message);
        toast.error('Delete failed', message);
      },
    });
  };

  const handleToggle = (t: CompensationType) => {
    const nextIsActive = !t.is_active;
    toggleMutation.mutate(
      { id: t.id, isActive: nextIsActive },
      {
        onSuccess: () => {
          toast.success(nextIsActive ? 'Compensation type activated' : 'Compensation type deactivated');
        },
        onError: (err) => {
          const message = isAxiosError(err) ? err.response?.data?.error || 'Failed to toggle compensation type' : 'Failed to toggle compensation type';
          setError(message);
          toast.error('Toggle failed', message);
        },
      }
    );
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const current = types;
    const from = current.findIndex((t) => t.id === dragId);
    const to = current.findIndex((t) => t.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setLocalOrder(next);
    setDragId(null);
    reorderMutation.mutate(
      next.map((t) => t.id),
      {
        onSuccess: () => toast.success('Order saved'),
        onSettled: () => setLocalOrder(null),
      }
    );
  };

  if (typesQuery.isLoading) {
    return <Loader message="Loading compensation types…" size="sm" className="p-4" />;
  }

  return (
    <div>
      {types.length === 0 ? (
        <div className="mb-2 rounded-md border border-dashed border-[#e2e8f0] p-4 text-center text-[0.8rem] text-[#94a3b8]">Nothing configured yet.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {types.map((t) => {
            const usageCount = t.usage?.demands ?? 0;
            const inUseMessage = usageCount > 0
              ? `In use (${usageCount} demands). Rename and delete are disabled. Use Deactivate to stop new use.`
              : undefined;
            return (
              <div
                key={t.id}
                draggable={editingId !== t.id}
                onDragStart={() => setDragId(t.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(t.id)}
                className={`flex items-center gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 ${t.is_active ? '' : 'opacity-60'}`}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#cbd5e1]" />
                {editingId === t.id ? (
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => commitEdit(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEdit(t.id); }
                      else if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="h-7 w-full rounded border-[#e2e8f0] bg-white px-2 py-0 text-[0.82rem] shadow-none"
                  />
                ) : (
                  <span className="flex-1 truncate text-[0.82rem] font-medium text-[#0f172a]">{t.name}</span>
                )}
                {!editingId && (
                  <SettingsItemRowActions
                    name={t.name}
                    isActive={t.is_active}
                    onEdit={() => { setError(null); setEditingId(t.id); setEditName(t.name); }}
                    onDelete={() => handleDelete(t.id)}
                    onToggle={() => handleToggle(t)}
                    disabled={deleteMutation.isPending || updateMutation.isPending}
                    pending={toggleMutation.isPending}
                    lockedMessage={inUseMessage}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Input
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveAdd(); } }}
          placeholder="Name (e.g. Bi-Weekly)"
          className="h-auto flex-1 rounded-md border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[0.83rem] shadow-none"
        />
        <Button size="sm" variant="outline" onClick={saveAdd} disabled={createMutation.isPending} className="h-auto shrink-0 gap-1.5 px-2.5 py-1.5">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {error && <div className="mt-2 rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{error}</div>}
    </div>
  );
}
