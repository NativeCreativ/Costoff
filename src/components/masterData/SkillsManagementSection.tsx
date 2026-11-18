'use client';

import { useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/Toast';
import { FormSelect } from '@/components/ui/FormSelect';
import { SettingsItemRowActions } from '@/components/interviewRounds/SettingsItemRowActions';
import { useSkillsLibraryQueryIncludeInactive } from '@/queries/settings/useSkillsLibraryQueries';
import { useCreateSkillMutation, useRenameSkillMutation, useDeleteSkillMutation, useToggleSkillMutation } from '@/queries/settings/useSkillsLibraryMutations';
import { useNamedMasterQuery } from '@/queries/masterData/useMasterData';
import { NamedMasterSection } from './NamedMasterSection';
import type { Skill } from '@/components/types';

const TYPE_OPTIONS = [
  { value: 'mandatory', label: 'Mandatory' },
  { value: 'optional', label: 'Optional' },
];

interface Draft {
  id?: string;
  name: string;
  categoryId: string;
  skillType: 'mandatory' | 'optional';
  classificationId: string;
}

const EMPTY_DRAFT: Draft = { name: '', categoryId: '', skillType: 'optional', classificationId: '' };

function errorText(err: unknown, fallback: string) {
  return isAxiosError(err) ? err.response?.data?.error || fallback : fallback;
}

export function SkillsManagementSection() {
  const libraryQuery = useSkillsLibraryQueryIncludeInactive();
  const classifications = useNamedMasterQuery('skill-classifications');
  const createSkill = useCreateSkillMutation();
  const updateSkill = useRenameSkillMutation();
  const deleteSkill = useDeleteSkillMutation();
  const toggleSkill = useToggleSkillMutation();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = libraryQuery.data ?? [];
  const skills = useMemo(
    () => categories.flatMap((category) => category.skills.map((skill) => ({ ...skill, groupName: category.name }))),
    [categories]
  );
  const classificationName = (id?: string | null) =>
    classifications.data?.find((row) => row.id === id)?.name ?? '—';
  // Review batch 5: skills listed under their Skill Category (Technical, Domain, …).
  const groupedByCategory = useMemo(() => {
    const order = (classifications.data ?? []).map((c) => c.id);
    const groups = new Map<string, typeof skills>();
    for (const skill of skills) {
      const key = skill.classification_id && order.includes(skill.classification_id) ? skill.classification_id : '';
      groups.set(key, [...(groups.get(key) ?? []), skill]);
    }
    return [...order, '']
      .filter((key) => groups.has(key))
      .map((key) => ({ heading: key ? classificationName(key) : 'No skill category', rows: groups.get(key)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skills, classifications.data]);

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.categoryId) {
      setError('Name and skill group are required');
      return;
    }
    setError(null);
    const payload = {
      name: draft.name.trim(),
      skill_type: draft.skillType,
      classification_id: draft.classificationId || null,
      category_id: draft.categoryId,
    };
    const done = {
      onSuccess: () => {
        toast.success(draft.id ? 'Skill updated' : 'Skill added');
        setDraft(null);
      },
      onError: (err: unknown) => {
        const text = errorText(err, 'Failed to save skill');
        setError(text);
        toast.error('Save failed', text);
      },
    };
    if (draft.id) updateSkill.mutate({ id: draft.id, ...payload }, done);
    else createSkill.mutate({ categoryId: draft.categoryId, name: payload.name, skill_type: payload.skill_type, classification_id: payload.classification_id }, done);
  };

  if (libraryQuery.isLoading) return <Loader message="Loading skills…" size="sm" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 text-[0.95rem] font-semibold text-[#0f172a]">Skills</h2>
        <p className="mb-3 text-[0.78rem] text-[#64748b]">
          Type is Mandatory or Optional. Skill Category (Technical, Behavioural, Domain) is a classification, separate from the skill group template.
        </p>
        {skills.length === 0 && <p className="mb-3 text-[0.8rem] text-[#94a3b8]">No skills yet. Add a skill group first, then a skill.</p>}
        <div className="flex flex-col gap-1.5">
          {groupedByCategory.map(({ heading, rows }) => [
            <div key={'h-' + heading} className="mt-2 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb] first:mt-0">{heading} · {rows.length}</div>,
            ...rows.map((skill) => (
            <div key={skill.id} className={`flex flex-wrap items-center gap-2 rounded-md border border-[#e2e8f0] px-3 py-2 ${skill.is_active ? '' : 'opacity-60'}`}>
              <span className="min-w-[140px] flex-1 text-[0.85rem] font-medium text-[#0f172a]">{skill.name}</span>
              <span className="text-[0.75rem] text-[#64748b]">{skill.groupName}</span>
              <span className="text-[0.75rem] text-[#334155]">{skill.skill_type === 'mandatory' ? 'Mandatory' : 'Optional'}</span>
              <span className="text-[0.75rem] text-[#334155]">{classificationName(skill.classification_id)}</span>
              <SettingsItemRowActions
                name={skill.name}
                isActive={skill.is_active}
                onEdit={() => setDraft({
                  id: skill.id,
                  name: skill.name,
                  categoryId: skill.category_id,
                  skillType: skill.skill_type === 'mandatory' ? 'mandatory' : 'optional',
                  classificationId: skill.classification_id || '',
                })}
                onDelete={() => deleteSkill.mutate(skill.id, { onError: (err) => toast.error('Delete failed', errorText(err, 'Failed to delete skill')) })}
                onToggle={() => toggleSkill.mutate({ id: skill.id, isActive: !skill.is_active })}
              />
            </div>
          )),
          ])}
        </div>
        {draft ? (
          <div className="mt-3 grid grid-cols-1 gap-2 rounded-md border border-[#bfdbfe] bg-[#eff6ff] p-3 sm:grid-cols-2">
            <Input value={draft.name} placeholder="Skill name" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <FormSelect
              label="Skill group"
              value={draft.categoryId}
              onChange={(value) => setDraft({ ...draft, categoryId: value })}
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
              placeholder="Select a skill group"
            />
            <FormSelect
              label="Type"
              value={draft.skillType}
              onChange={(value) => setDraft({ ...draft, skillType: value === 'mandatory' ? 'mandatory' : 'optional' })}
              options={TYPE_OPTIONS}
            />
            <FormSelect
              label="Skill category"
              value={draft.classificationId}
              onChange={(value) => setDraft({ ...draft, classificationId: value })}
              options={(classifications.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
              allowClear
              clearLabel="None"
              placeholder="Technical, behavioural, domain…"
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="button" onClick={save} disabled={createSkill.isPending || updateSkill.isPending}>Save skill</Button>
              <Button type="button" variant="outline" onClick={() => { setDraft(null); setError(null); }}>Cancel</Button>
            </div>
            {error && <p className="text-[0.78rem] text-[#dc2626] sm:col-span-2">{error}</p>}
          </div>
        ) : (
          <Button type="button" variant="outline" className="mt-3" onClick={() => setDraft({ ...EMPTY_DRAFT, categoryId: categories[0]?.id ?? '' })}>
            Add skill
          </Button>
        )}
      </div>
      <div>
        <h2 className="mb-1 text-[0.95rem] font-semibold text-[#0f172a]">Skill categories</h2>
        <p className="mb-3 text-[0.78rem] text-[#64748b]">Classifications such as Technical, Behavioural and Domain. These are not skill-group templates.</p>
        <NamedMasterSection kind="skill-classifications" noun="skill category" />
      </div>
    </div>
  );
}

export type { Skill };
