'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/Toast';
import { SettingsItemRowActions } from '@/components/interviewRounds/SettingsItemRowActions';
import {
  useCreateNamedMasterMutation,
  useDeleteNamedMasterMutation,
  useNamedMasterIncludeInactiveQuery,
  useReorderNamedMasterMutation,
  useToggleNamedMasterMutation,
  useUpdateNamedMasterMutation,
} from '@/queries/masterData/useMasterData';
import type { NamedMasterItem, NamedMasterKind } from '@/services/masterData.service';

function message(err: unknown, fallback: string): string {
  return isAxiosError(err) ? err.response?.data?.error || fallback : fallback;
}

export function NamedMasterSection({ kind, noun }: { kind: NamedMasterKind; noun: string }) {
  const listQuery = useNamedMasterIncludeInactiveQuery(kind);
  const createMutation = useCreateNamedMasterMutation(kind);
  const updateMutation = useUpdateNamedMasterMutation(kind);
  const deleteMutation = useDeleteNamedMasterMutation(kind);
  const toggleMutation = useToggleNamedMasterMutation(kind);
  const reorderMutation = useReorderNamedMasterMutation(kind);
  const toast = useToast();

  const [addName, setAddName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<NamedMasterItem[] | null>(null);

  const items = localOrder ?? listQuery.data ?? [];

  if (listQuery.isLoading) return <Loader message={`Loading ${noun}s…`} size="sm" className="p-4" />;
  if (listQuery.isError) {
    return <p className="text-[0.85rem] text-[#dc2626]">Could not load {noun}s. Apply the master-data migration and refresh.</p>;
  }

  const saveAdd = () => {
    const name = addName.trim();
    if (!name) {
      setError('Name is required');
      return;
    }
    setError(null);
    createMutation.mutate(name, {
      onSuccess: () => {
        setAddName('');
        toast.success(`${noun} added`);
      },
      onError: (err) => {
        const text = message(err, `Failed to add ${noun}`);
        setError(text);
        toast.error('Create failed', text);
      },
    });
  };

  const commitEdit = (id: string) => {
    const name = editName.trim();
    setEditingId(null);
    const current = items.find((item) => item.id === id);
    if (!name || !current || current.name === name) return;
    setError(null);
    updateMutation.mutate(
      { id, name },
      {
        onSuccess: () => toast.success(`${noun} updated`),
        onError: (err) => {
          const text = message(err, `Failed to update ${noun}`);
          setError(text);
          toast.error('Update failed', text);
        },
      }
    );
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = items.findIndex((item) => item.id === dragId);
    const to = items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setLocalOrder(next);
    setDragId(null);
    reorderMutation.mutate(next.map((item) => item.id), { onSettled: () => setLocalOrder(null) });
  };

  return (
    <div>
      {items.length === 0 ? (
        <div className="mb-3 rounded-md border border-dashed border-[#e2e8f0] p-4 text-center text-[0.8rem] text-[#94a3b8]">
          No {noun}s yet.
        </div>
      ) : (
        <div className="mb-3 flex flex-col gap-1.5">
          {items.map((item) => {
            const usage = item.usage?.records ?? 0;
            const lockedMessage = usage > 0
              ? `In use (${usage} record${usage === 1 ? '' : 's'}). Rename and delete are disabled. Deactivate it to hide it from new demands.`
              : undefined;
            return (
              <div
                key={item.id}
                draggable={editingId !== item.id}
                onDragStart={() => setDragId(item.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(item.id)}
                className={`flex items-center gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 ${item.is_active ? '' : 'opacity-60'}`}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#cbd5e1]" />
                {editingId === item.id ? (
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(item.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => commitEdit(item.id)}
                    className="h-8 flex-1"
                  />
                ) : (
                  <span className="flex-1 text-[0.85rem] text-[#334155]">
                    {item.name}
                    {item.is_transition === false && (
                      <span className="ml-2 text-[0.7rem] text-[#94a3b8]">Creation only</span>
                    )}
                    {item.requires_result && (
                      <span className="ml-2 text-[0.7rem] text-[#94a3b8]">Requires a result</span>
                    )}
                  </span>
                )}
                <SettingsItemRowActions
                  name={item.name}
                  isActive={item.is_active}
                  lockedMessage={lockedMessage}
                  pending={toggleMutation.isPending || deleteMutation.isPending}
                  onEdit={() => {
                    setEditingId(item.id);
                    setEditName(item.name);
                  }}
                  onDelete={() => {
                    deleteMutation.mutate(item.id, {
                      onSuccess: () => toast.success(`${noun} deleted`),
                      onError: (err) => toast.error('Delete failed', message(err, `Failed to delete ${noun}`)),
                    });
                  }}
                  onToggle={() => {
                    toggleMutation.mutate(
                      { id: item.id, isActive: !item.is_active },
                      { onError: (err) => toast.error('Toggle failed', message(err, `Failed to update ${noun}`)) }
                    );
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={addName}
          placeholder={`New ${noun}`}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              saveAdd();
            }
          }}
          className="h-9 sm:max-w-sm"
        />
        <Button type="button" onClick={saveAdd} disabled={createMutation.isPending}>
          Add
        </Button>
      </div>
      {error && <p className="mt-2 text-[0.78rem] text-[#dc2626]">{error}</p>}
    </div>
  );
}
