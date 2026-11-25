'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNamedMasterQuery } from '@/queries/masterData/useMasterData';
import { useCreateSkillMutation } from '@/queries/settings/useSkillsLibraryMutations';
import { useToast } from '@/components/ui/Toast';
import type { SkillCategory } from '@/components/types';

interface SkillCategoryPickerProps {
  /** The skill group being edited. */
  group: SkillCategory;
  /** Every skill group (the whole library), to collect the skills of each Skill Category. */
  groups: SkillCategory[];
}

/**
 * Review batch 5 (Nov 2026): build a Skill Group from the Skill Categories (Technical, Domain,
 * Non-technical, Engineering, SemiConductor…). Pick a category to see every skill of that
 * category in the library that this group does not have yet, and add them with one click each
 * (or all at once). Added skills keep their Skill Category.
 */
export function SkillCategoryPicker({ group, groups }: SkillCategoryPickerProps) {
  const toast = useToast();
  const classifications = useNamedMasterQuery('skill-classifications');
  const createSkill = useCreateSkillMutation();
  const [categoryId, setCategoryId] = useState('');

  const inGroup = useMemo(() => new Set(group.skills.map((s) => s.name.trim().toLowerCase())), [group.skills]);
  const available = useMemo(() => {
    if (!categoryId) return [];
    const byName = new Map<string, string>();
    for (const g of groups) {
      for (const s of g.skills) {
        const key = s.name.trim().toLowerCase();
        if (s.is_active && s.classification_id === categoryId && !inGroup.has(key) && !byName.has(key)) byName.set(key, s.name);
      }
    }
    return [...byName.values()].sort((a, b) => a.localeCompare(b));
  }, [categoryId, groups, inGroup]);

  const add = (names: string[]) => {
    names.forEach((name) =>
      createSkill.mutate(
        { categoryId: group.id, name, classification_id: categoryId },
        { onError: () => toast.error('Could not add', `${name} was not added`) }
      )
    );
  };

  const activeCategories = (classifications.data ?? []).filter((c) => c.is_active !== false);
  if (activeCategories.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-[#e2e8f0] bg-white p-2.5">
      <div className="mb-1.5 text-[0.78rem] font-semibold text-[#475569]">Add skills by classification</div>
      <div className="flex flex-wrap gap-1.5">
        {activeCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={categoryId === c.id}
            onClick={() => setCategoryId(categoryId === c.id ? '' : c.id)}
            className={`rounded-full border px-2.5 py-1 text-[0.74rem] ${categoryId === c.id ? 'border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]'}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      {categoryId && (
        <div className="mt-2">
          {available.length === 0 ? (
            <p className="text-[0.75rem] text-[#94a3b8]">No other skills in this category yet. Set a skill&apos;s category in Skills Management.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {available.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={createSkill.isPending}
                    onClick={() => add([name])}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#93c5fd] px-2 py-0.5 text-[0.74rem] text-[#1d4ed8] hover:bg-[#eff6ff]"
                  >
                    <Plus className="h-3 w-3" /> {name}
                  </button>
                ))}
              </div>
              <button type="button" disabled={createSkill.isPending} className="mt-1.5 text-[0.74rem] font-semibold text-[#2563eb] hover:underline" onClick={() => add(available)}>
                Add all {available.length}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
