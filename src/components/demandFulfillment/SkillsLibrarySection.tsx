'use client';

import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { GripVertical, Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/Loader';
import { SettingsItemRowActions } from '@/components/interviewRounds/SettingsItemRowActions';
import { useSkillsLibraryQueryIncludeInactive } from '@/queries/settings/useSkillsLibraryQueries';
import {
  useCreateSkillCategoryMutation,
  useRenameSkillCategoryMutation,
  useDeleteSkillCategoryMutation,
  useReorderSkillCategoriesMutation,
  useCreateSkillMutation,
  useRenameSkillMutation,
  useDeleteSkillMutation,
  useReorderSkillsMutation,
  useToggleSkillCategoryMutation,
  useToggleSkillMutation,
} from '@/queries/settings/useSkillsLibraryMutations';
import type { SkillCategory } from '@/components/types';

function errorMessage(err: unknown, fallback: string): string {
  return isAxiosError(err) ? err.response?.data?.error || fallback : fallback;
}

/**
 * Admin-only "Skills library" section (Demand Fulfillment Settings): categories on the left,
 * the selected category's skills on the right. Uses the shared SettingsItemRowActions for
 * pencil/trash/switch. Category rename is always allowed; delete is disabled with a tooltip
 * when any of its skills is in use. Deactivating a category hides it and its skills from
 * the picker (saved skills on records stay untouched).
 */
export function SkillsLibrarySection() {
  const libraryQuery = useSkillsLibraryQueryIncludeInactive();
  const createCategory = useCreateSkillCategoryMutation();
  const renameCategory = useRenameSkillCategoryMutation();
  const deleteCategory = useDeleteSkillCategoryMutation();
  const reorderCategories = useReorderSkillCategoriesMutation();
  const createSkill = useCreateSkillMutation();
  const renameSkill = useRenameSkillMutation();
  const deleteSkill = useDeleteSkillMutation();
  const reorderSkills = useReorderSkillsMutation();
  const toggleCategory = useToggleSkillCategoryMutation();
  const toggleSkill = useToggleSkillMutation();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDescription, setEditCategoryDescription] = useState('');
  const [dragCategoryId, setDragCategoryId] = useState<string | null>(null);
  const [localCategoryOrder, setLocalCategoryOrder] = useState<SkillCategory[] | null>(null);

  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editSkillName, setEditSkillName] = useState('');
  const [dragSkillId, setDragSkillId] = useState<string | null>(null);
  const [localSkillOrder, setLocalSkillOrder] = useState<SkillCategory['skills'] | null>(null);

  const categories = localCategoryOrder ?? libraryQuery.data ?? [];
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const skills = localSkillOrder ?? selectedCategory?.skills ?? [];

  // Select the first category by default once the library loads.
  useEffect(() => {
    if (selectedCategoryId || categories.length === 0) return;
    setSelectedCategoryId(categories[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  if (libraryQuery.isLoading) {
    return <Loader message="Loading skills library…" size="sm" className="p-4" />;
  }

  const saveNewCategory = () => {
    setError(null);
    const name = newCategoryName.trim();
    if (!name) { setError('Category name is required'); return; }
    createCategory.mutate({ name, description: newCategoryDescription }, {
      onSuccess: () => { setAddingCategory(false); setNewCategoryName(''); setNewCategoryDescription(''); },
      onError: (err) => setError(errorMessage(err, 'Failed to create skill group')),
    });
  };

  const saveRenameCategory = (id: string) => {
    setError(null);
    const name = editCategoryName.trim();
    if (!name) { setError('Category name is required'); return; }
    renameCategory.mutate({ id, name, description: editCategoryDescription }, {
      onSuccess: () => setEditingCategoryId(null),
      onError: (err) => setError(errorMessage(err, 'Failed to update skill group')),
    });
  };

  // Category delete is blocked when any of its skills is in use (backend enforces this
  // with a 409). The tooltip explains why.
  const categoryDeleteTooltip = (c: SkillCategory): string | undefined => {
    // The backend rejects the delete with a 409; we show a tooltip explaining why.
    // We don't have per-skill usage counts in the list response, so we always show
    // the tooltip when the category has skills — the backend is the real guard.
    if (c.skills.length === 0) return undefined;
    return 'This category has skills that may be in use. Delete is blocked when any skill is referenced.';
  };

  const confirmDeleteCategory = (id: string) => {
    setError(null);
    deleteCategory.mutate(id, {
      onSuccess: () => {
        if (selectedCategoryId === id) setSelectedCategoryId(null);
      },
      onError: (err) => setError(errorMessage(err, 'Failed to delete category')),
    });
  };

  const handleCategoryDrop = (targetId: string) => {
    if (!dragCategoryId || dragCategoryId === targetId) return;
    const current = categories;
    const from = current.findIndex((c) => c.id === dragCategoryId);
    const to = current.findIndex((c) => c.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setLocalCategoryOrder(next);
    setDragCategoryId(null);
    reorderCategories.mutate(next.map((c) => c.id), { onSettled: () => setLocalCategoryOrder(null) });
  };

  const saveNewSkill = () => {
    setError(null);
    if (!selectedCategory) return;
    const name = newSkillName.trim();
    if (!name) { setError('Skill name is required'); return; }
    createSkill.mutate({ categoryId: selectedCategory.id, name }, {
      onSuccess: () => { setAddingSkill(false); setNewSkillName(''); },
      onError: (err) => setError(errorMessage(err, 'Failed to create skill')),
    });
  };

  const saveRenameSkill = (id: string) => {
    setError(null);
    const name = editSkillName.trim();
    if (!name) { setError('Skill name is required'); return; }
    renameSkill.mutate({ id, name }, {
      onSuccess: () => setEditingSkillId(null),
      onError: (err) => setError(errorMessage(err, 'Failed to rename skill')),
    });
  };

  const confirmDeleteSkill = (id: string) => {
    setError(null);
    deleteSkill.mutate(id, {
      onError: (err) => setError(errorMessage(err, 'Failed to delete skill')),
    });
  };

  const handleSkillDrop = (targetId: string) => {
    if (!dragSkillId || dragSkillId === targetId) return;
    const current = skills;
    const from = current.findIndex((s) => s.id === dragSkillId);
    const to = current.findIndex((s) => s.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setLocalSkillOrder(next);
    setDragSkillId(null);
    reorderSkills.mutate(next.map((s) => s.id), { onSettled: () => setLocalSkillOrder(null) });
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Categories (left) */}
        <div>
          <div className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#94a3b8]">Skill groups</div>
          {categories.length === 0 && !addingCategory && (
            <div className="mb-2 rounded-md border border-dashed border-[#e2e8f0] p-4 text-center text-[0.8rem] text-[#94a3b8]">No skill groups yet.</div>
          )}
          <div className="flex flex-col gap-1.5">
            {categories.map((c) => {
              const delTip = categoryDeleteTooltip(c);
              return (
                <div
                  key={c.id}
                  draggable={editingCategoryId !== c.id}
                  onDragStart={() => setDragCategoryId(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleCategoryDrop(c.id)}
                  onClick={() => editingCategoryId !== c.id && setSelectedCategoryId(c.id)}
                  className={`flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-2 ${
                    selectedCategoryId === c.id ? 'border-[#93c5fd] bg-[#eff6ff]' : 'border-[#e2e8f0] bg-[#f8fafc]'
                  } ${editingCategoryId !== c.id ? 'cursor-pointer' : ''} ${c.is_active ? '' : 'opacity-60'}`}
                >
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#cbd5e1]" />
                  {editingCategoryId === c.id ? (
                    <>
                      <Input
                        autoFocus
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); saveRenameCategory(c.id); }
                          else if (e.key === 'Escape') setEditingCategoryId(null);
                        }}
                        maxLength={40}
                        placeholder="Name"
                        className="h-auto min-w-[120px] flex-1 rounded-md border-[#e2e8f0] bg-white px-2 py-1 text-[0.82rem] shadow-none"
                      />
                      <Input
                        value={editCategoryDescription}
                        onChange={(e) => setEditCategoryDescription(e.target.value)}
                        placeholder="Description"
                        className="h-auto min-w-[140px] flex-1 rounded-md border-[#e2e8f0] bg-white px-2 py-1 text-[0.82rem] shadow-none"
                      />
                      <button onClick={(e) => { e.stopPropagation(); saveRenameCategory(c.id); }} className="shrink-0 text-[#16a34a] hover:text-[#15803d]"><Check className="h-4 w-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingCategoryId(null); }} className="shrink-0 text-[#94a3b8] hover:text-[#475569]"><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.83rem] text-[#334155]">{c.name}</span>
                        {c.description && <span className="block truncate text-[0.72rem] text-[#94a3b8]">{c.description}</span>}
                      </span>
                      <span className="shrink-0 text-[0.7rem] text-[#94a3b8]">{c.skills.length}</span>
                      <SettingsItemRowActions
                        name={c.name}
                        isActive={c.is_active}
                        onEdit={(e) => { e?.stopPropagation(); setEditingCategoryId(c.id); setEditCategoryName(c.name); setEditCategoryDescription(c.description || ''); setError(null); }}
                        onDelete={(e) => { e?.stopPropagation(); confirmDeleteCategory(c.id); }}
                        onToggle={(e) => { e?.stopPropagation(); toggleCategory.mutate({ id: c.id, isActive: !c.is_active }); }}
                        pending={toggleCategory.isPending}
                        lockedMessage={delTip}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {addingCategory ? (
            <div className="mt-2 flex flex-col gap-2 rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-2.5 py-2">
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); saveNewCategory(); }
                    else if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryName(''); setNewCategoryDescription(''); setError(null); }
                  }}
                  maxLength={40}
                  placeholder="Skill group name"
                  className="h-auto flex-1 rounded-md border-[#e2e8f0] bg-white px-2 py-1 text-[0.82rem] shadow-none"
                />
                <button onClick={saveNewCategory} disabled={createCategory.isPending} className="shrink-0 text-[#16a34a] hover:text-[#15803d]"><Check className="h-4 w-4" /></button>
                <button onClick={() => { setAddingCategory(false); setNewCategoryName(''); setNewCategoryDescription(''); setError(null); }} className="shrink-0 text-[#94a3b8] hover:text-[#475569]"><X className="h-4 w-4" /></button>
              </div>
              <Input
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                placeholder="Description"
                className="h-auto rounded-md border-[#e2e8f0] bg-white px-2 py-1 text-[0.82rem] shadow-none"
              />
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => { setAddingCategory(true); setError(null); }} className="mt-2 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add skill group
            </Button>
          )}
        </div>

        {/* Skills of the selected category (right) */}
        <div>
          <div className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#94a3b8]">
            Skills{selectedCategory ? ` — ${selectedCategory.name}` : ''}
          </div>
          {!selectedCategory ? (
            <div className="rounded-md border border-dashed border-[#e2e8f0] p-4 text-center text-[0.8rem] text-[#94a3b8]">Select or add a skill group to manage its skills.</div>
          ) : (
            <>
              {skills.length === 0 && !addingSkill && (
                <div className="mb-2 rounded-md border border-dashed border-[#e2e8f0] p-4 text-center text-[0.8rem] text-[#94a3b8]">No skills in this category yet.</div>
              )}
              <div className="flex flex-col gap-1.5">
                {skills.map((s) => (
                  <div
                    key={s.id}
                    draggable={editingSkillId !== s.id}
                    onDragStart={() => setDragSkillId(s.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleSkillDrop(s.id)}
                    className={`flex items-center gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-2 ${s.is_active ? '' : 'opacity-60'}`}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#cbd5e1]" />
                    {editingSkillId === s.id ? (
                      <>
                        <Input
                          autoFocus
                          value={editSkillName}
                          onChange={(e) => setEditSkillName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveRenameSkill(s.id); }
                            else if (e.key === 'Escape') setEditingSkillId(null);
                          }}
                          maxLength={40}
                          className="h-auto flex-1 rounded-md border-[#e2e8f0] bg-white px-2 py-1 text-[0.82rem] shadow-none"
                        />
                        <button onClick={() => saveRenameSkill(s.id)} className="shrink-0 text-[#16a34a] hover:text-[#15803d]"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditingSkillId(null)} className="shrink-0 text-[#94a3b8] hover:text-[#475569]"><X className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate text-[0.83rem] text-[#334155]">{s.name}</span>
                        <SettingsItemRowActions
                          name={s.name}
                          isActive={s.is_active}
                          onEdit={() => { setEditingSkillId(s.id); setEditSkillName(s.name); setError(null); }}
                          onDelete={() => confirmDeleteSkill(s.id)}
                          onToggle={() => toggleSkill.mutate({ id: s.id, isActive: !s.is_active })}
                          pending={toggleSkill.isPending}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>

              {addingSkill ? (
                <div className="mt-2 flex items-center gap-2 rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-2.5 py-2">
                  <Input
                    autoFocus
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); saveNewSkill(); }
                      else if (e.key === 'Escape') { setAddingSkill(false); setNewSkillName(''); setError(null); }
                    }}
                    maxLength={40}
                    placeholder="Skill name (e.g. React)"
                    className="h-auto flex-1 rounded-md border-[#e2e8f0] bg-white px-2 py-1 text-[0.82rem] shadow-none"
                  />
                  <button onClick={saveNewSkill} disabled={createSkill.isPending} className="shrink-0 text-[#16a34a] hover:text-[#15803d]"><Check className="h-4 w-4" /></button>
                  <button onClick={() => { setAddingSkill(false); setNewSkillName(''); setError(null); }} className="shrink-0 text-[#94a3b8] hover:text-[#475569]"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { setAddingSkill(true); setError(null); }} className="mt-2 gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Skill
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <div className="mt-3 rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.78rem] text-[#dc2626]">{error}</div>}
    </div>
  );
}
