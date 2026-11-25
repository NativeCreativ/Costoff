'use client';

import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/Loader';
import { SettingsItemRowActions } from '@/components/interviewRounds/SettingsItemRowActions';
import { useAdminSkillGroupsQuery, useSkillGroupMutations } from '@/queries/settings/useSkillGroups';

/**
 * Skill Groups — the top of Skill Group -> Skill Category -> Skills (review of 18 Nov 2026).
 * A group (e.g. "Engineering") holds Skill Categories (e.g. "Backend developer"), and each
 * category holds its skills. Categories are put into a group on the Skill Categories list below.
 */
export function SkillGroupsSection() {
  const query = useAdminSkillGroupsQuery();
  const { create, update, remove } = useSkillGroupMutations();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groups = query.data ?? [];

  const reset = () => { setAdding(false); setEditingId(null); setName(''); setDescription(''); setError(null); };
  const save = () => {
    if (!name.trim()) { setError('Name is required'); return; }
    const input = { name: name.trim(), description: description.trim() };
    if (editingId) update.mutate({ id: editingId, ...input }, { onSuccess: reset });
    else create.mutate(input, { onSuccess: reset });
  };

  if (query.isLoading) return <Loader message="Loading skill groups…" size="sm" />;

  const form = (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-2.5 py-2">
      <Input autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Skill group (e.g. Engineering)" className="h-8 min-w-[180px] flex-1 bg-white text-[0.82rem]" />
      <Input value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="h-8 min-w-[180px] flex-[2] bg-white text-[0.82rem]" />
      <button type="button" aria-label="Save skill group" onClick={save} disabled={create.isPending || update.isPending} className="text-[#16a34a] hover:text-[#15803d]"><Check className="h-4 w-4" /></button>
      <button type="button" aria-label="Cancel" onClick={reset} className="text-[#94a3b8] hover:text-[#475569]"><X className="h-4 w-4" /></button>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-[0.95rem] font-semibold text-[#0f172a]">Skill Groups</h2>
        <p className="text-[0.78rem] text-[#64748b]">
          The top level: Skill Group → Skill Category → Skills. Put each Skill Category into a group in the list below.
        </p>
      </div>
      {groups.length === 0 && !adding && <p className="text-[0.8rem] text-[#94a3b8]">No skill groups yet.</p>}
      <div className="flex flex-col gap-1.5">
        {groups.map((g) =>
          editingId === g.id ? (
            <div key={g.id}>{form}</div>
          ) : (
            <div key={g.id} className={`flex items-center gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-2 ${g.is_active ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <span className="text-[0.85rem] font-semibold text-[#0f172a]">{g.name}</span>
                <span className="ml-2 text-[0.74rem] text-[#64748b]">{g.category_count ?? 0} categor{g.category_count === 1 ? 'y' : 'ies'}</span>
                {g.description && <div className="truncate text-[0.74rem] text-[#64748b]">{g.description}</div>}
              </div>
              <SettingsItemRowActions
                name={g.name}
                isActive={g.is_active}
                onEdit={() => { setEditingId(g.id); setAdding(false); setName(g.name); setDescription(g.description ?? ''); setError(null); }}
                onDelete={() => remove.mutate(g.id)}
                onToggle={() => update.mutate({ id: g.id, name: g.name, description: g.description ?? '', is_active: !g.is_active })}
                pending={update.isPending}
              />
            </div>
          )
        )}
      </div>
      {adding ? form : !editingId && (
        <Button size="sm" variant="outline" className="w-fit gap-1.5" onClick={() => { setAdding(true); setName(''); setDescription(''); setError(null); }}>
          <Plus className="h-3.5 w-3.5" /> Add Skill Group
        </Button>
      )}
      {error && <p className="text-[0.75rem] text-[#dc2626]">{error}</p>}
    </div>
  );
}
