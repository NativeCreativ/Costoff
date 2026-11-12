'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { GripVertical, Plus, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { findOrCreateInterviewRound, type ConfiguredRound } from '@/services/interviewRound.service';
import { SettingsItemRowActions } from './SettingsItemRowActions';

interface LockInfo {
  locked: boolean;
  message?: string;
}

interface InterviewRoundConfiguratorProps {
  /** 'company' shows the Usage badge and the Active/Inactive toggle (Clients Master → Add/Edit
   *  Client); 'demand' is the simpler row used by the Demand form — no Usage, no Status toggle. */
  variant: 'company' | 'demand';
  rounds: ConfiguredRound[];
  onChange: (rounds: ConfiguredRound[]) => void;
  disabled?: boolean;
  addPlaceholder?: string;
  addModePlaceholder?: string;
  description?: React.ReactNode;
  allowAdd?: boolean;
  /** A round this callback reports as locked may not be renamed, have its mode edited, or be
   *  deleted — only the lock icon and a tooltip are shown for Edit/Delete. */
  lockedInfo?: (key: string) => LockInfo | undefined;
  /** 'company' variant only: how many of this company's own demands (or a candidate interview)
   *  already use this round, for the Usage badge. */
  usageCount?: (key: string) => number | undefined;
  /** 'company' variant only: flips a round's Active/Inactive flag in local state — committed by
   *  the surrounding form's normal Save, same as every other field here. */
  onToggleRound?: (round: ConfiguredRound) => void;
}

function reindex(rounds: ConfiguredRound[]): ConfiguredRound[] {
  return rounds.map((r, i) => ({ ...r, order: i + 1 }));
}

export function roundIdentity(r: ConfiguredRound): string {
  return r.round_id || `name:${r.name.trim().toLowerCase()}`;
}

export function InterviewRoundConfigurator({
  variant,
  rounds,
  onChange,
  disabled = false,
  addPlaceholder = 'Round name, e.g. Technical',
  addModePlaceholder = 'Mode, e.g. Video call',
  description,
  allowAdd = true,
  lockedInfo,
  usageCount,
  onToggleRound,
}: InterviewRoundConfiguratorProps) {
  const [newRound, setNewRound] = useState('');
  const [newMode, setNewMode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingMode, setEditingMode] = useState('');

  const createMutation = useMutation({
    mutationFn: (name: string) => findOrCreateInterviewRound(name),
    onSuccess: ({ round }) => {
      setNewRound('');
      const mode = newMode.trim();
      setNewMode('');
      addRound({ round_id: round.id, name: round.name, mode: mode || null, order: rounds.length + 1, mandatory: false, isActive: true });
    },
    onError: (err) =>
      setError(isAxiosError(err) ? err.response?.data?.error || 'Failed to add interview round' : 'Failed to add interview round'),
  });

  const selectedKeys = new Set(rounds.map(roundIdentity));
  const showUsage = variant === 'company';
  const showToggle = variant === 'company';

  function addRound(round: ConfiguredRound) {
    setError(null);
    if (selectedKeys.has(roundIdentity(round))) {
      setError(`"${round.name}" is already in this list`);
      return;
    }
    onChange(reindex([...rounds, round]));
  }

  function removeRound(key: string) {
    onChange(reindex(rounds.filter((r) => roundIdentity(r) !== key)));
  }

  function toggleMandatory(key: string) {
    onChange(rounds.map((r) => (roundIdentity(r) === key ? { ...r, mandatory: !r.mandatory } : r)));
  }

  function startEdit(round: ConfiguredRound) {
    setError(null);
    setEditingKey(roundIdentity(round));
    setEditingName(round.name);
    setEditingMode(round.mode ?? '');
  }

  function commitEdit(key: string) {
    const name = editingName.trim();
    const mode = editingMode.trim();
    setEditingKey(null);
    if (!name) return;
    const normalized = name.toLowerCase();
    const current = rounds.find((r) => roundIdentity(r) === key);
    if (!current) return;
    if (current.name.trim().toLowerCase() === normalized && (current.mode ?? '') === mode) return;
    if (rounds.some((r) => roundIdentity(r) !== key && r.name.trim().toLowerCase() === normalized)) {
      setError(`"${name}" is already in this list`);
      return;
    }
    onChange(rounds.map((r) => (roundIdentity(r) === key ? { ...r, name, mode: mode || null } : r)));
  }

  function handleDrop(targetKey: string) {
    const current = rounds;
    const from = current.findIndex((r) => roundIdentity(r) === dragId);
    const to = current.findIndex((r) => roundIdentity(r) === targetKey);
    if (from === -1 || to === -1) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(reindex(next));
    setDragId(null);
  }

  function commitNewRound() {
    const name = newRound.trim();
    if (!name) return;
    if (rounds.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())) {
      setError(`"${name}" is already in this list`);
      return;
    }
    createMutation.mutate(name);
  }

  return (
    <div>
      {description && <div className="mb-2 text-[0.78rem] text-[#94a3b8]">{description}</div>}

      <div className="flex flex-col gap-2">
        {rounds.length === 0 && (
          <div className="rounded-md border border-dashed border-[#e2e8f0] p-4 text-center text-[0.8rem] text-[#94a3b8]">
            No interview rounds configured yet.
          </div>
        )}

        {rounds.map((round) => {
          const key = roundIdentity(round);
          const lock = lockedInfo?.(key);
          const isLocked = !!lock?.locked;
          const isEditing = editingKey === key;
          const usage = usageCount?.(key);
          return (
            <div
              key={key}
              draggable={!disabled}
              onDragStart={() => setDragId(key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(key)}
              className={`flex items-center gap-2 rounded-md border border-[#e2e8f0] px-3 py-2 ${round.isActive === false ? 'bg-[#f8fafc] opacity-60' : 'bg-[#f8fafc]'}`}
            >
              {!disabled && <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#cbd5e1]" />}
              <span className="w-6 shrink-0 text-[0.78rem] font-bold text-[#2563eb]">{round.order}</span>
              {isEditing ? (
                <>
                  <Input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => commitEdit(key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitEdit(key);
                      } else if (e.key === 'Escape') {
                        setEditingKey(null);
                      }
                    }}
                    placeholder={addPlaceholder}
                    className="h-auto flex-1 rounded-md border-[#e2e8f0] bg-white px-2 py-1 text-[0.83rem] shadow-none"
                  />
                  <Input
                    value={editingMode}
                    onChange={(e) => setEditingMode(e.target.value)}
                    onBlur={() => commitEdit(key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitEdit(key);
                      } else if (e.key === 'Escape') {
                        setEditingKey(null);
                      }
                    }}
                    placeholder={addModePlaceholder}
                    className="h-auto flex-1 rounded-md border-[#e2e8f0] bg-white px-2 py-1 text-[0.83rem] shadow-none"
                  />
                </>
              ) : (
                <>
                  <span className={`flex-1 truncate text-[0.83rem] font-medium ${round.isActive === false ? 'text-[#94a3b8]' : 'text-[#0f172a]'}`}>{round.name}</span>
                  <span className="flex-1 truncate text-[0.83rem] text-[#64748b]">{round.mode || '—'}</span>
                </>
              )}
              {!disabled && (
                <label className="flex shrink-0 items-center gap-1.5 text-[0.76rem] text-[#475569]">
                  <input type="checkbox" checked={!!round.mandatory} onChange={() => toggleMandatory(key)} />
                  Mandatory
                </label>
              )}
              {round.mandatory && disabled && (
                <span className="shrink-0 text-[0.72rem] font-semibold text-[#475569]">Mandatory</span>
              )}
              {showUsage && (
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[0.68rem] font-semibold ${
                    usage ? 'bg-[#fffbeb] text-[#b45309]' : 'bg-[#f0fdf4] text-[#16a34a]'
                  }`}
                >
                  {usage ? `In use: ${usage}` : 'Not used'}
                </span>
              )}
              {!disabled && !isEditing && (
                <SettingsItemRowActions
                  name={round.name}
                  isActive={round.isActive !== false}
                  onEdit={() => startEdit(round)}
                  onDelete={() => removeRound(key)}
                  onToggle={() => onToggleRound?.(round)}
                  disabled={disabled}
                  showToggle={showToggle}
                  lockedMessage={isLocked ? (lock?.message ?? `"${round.name}" is in use and cannot be edited or deleted.`) : undefined}
                />
              )}
            </div>
          );
        })}
      </div>

      {allowAdd && !disabled && (
        <div className="mt-3 flex flex-col gap-2">
          {/* Add a brand-new round inline — creates the reusable master, or reuses it if the
              normalized name already exists. Mode is a purely local field (not part of the
              reusable master), attached once the name resolves. */}
          <div className="flex items-center gap-2">
            <Input
              value={newRound}
              onChange={(e) => setNewRound(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitNewRound();
                }
              }}
              placeholder={addPlaceholder}
              className="h-auto flex-1 rounded-md border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[0.83rem] shadow-none"
            />
            <Input
              value={newMode}
              onChange={(e) => setNewMode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitNewRound();
                }
              }}
              placeholder={addModePlaceholder}
              className="h-auto flex-1 rounded-md border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[0.83rem] shadow-none"
            />
            <Button type="button" size="sm" variant="outline" onClick={commitNewRound} disabled={createMutation.isPending || !newRound.trim()} className="h-auto shrink-0 gap-1.5 px-2.5 py-1.5">
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add Round
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">
          {error}
        </div>
      )}
      {createMutation.isError && !error && (
        <div className="mt-2 flex items-center gap-2 text-[0.78rem] text-[#dc2626]">
          Failed to add the round.
          <Button type="button" size="sm" variant="outline" onClick={() => createMutation.reset()} className="h-auto gap-1 px-2 py-0.5 text-[0.72rem]">
            <Check className="h-3 w-3" /> Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
