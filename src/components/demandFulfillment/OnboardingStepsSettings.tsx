'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/Loader';
import { CompanySelect } from '@/components/companies/CompanySelect';
import { cn } from '@/lib/utils';
import {
  useOnboardingStepTemplatesQuery,
  useSaveOnboardingStepTemplatesMutation,
  type OnboardingStepTemplateDraft,
} from '@/queries/onboarding/useOnboardingSteps';

/**
 * Ordered onboarding step lists: one Default list, plus an optional list per client. A client
 * without its own list uses the Default. Each candidate's onboarding gets its own copy of the
 * list when it is first opened, so edits here only affect onboardings that have not started.
 *
 * Saves on every action (add, rename, details, document flag, Active switch, reorder, remove),
 * like every other settings list — no Save button (docs/RULES.md §2).
 */
export function OnboardingStepsSettings() {
  const [scope, setScope] = useState<'default' | 'client'>('default');
  const [companyId, setCompanyId] = useState('');
  const listCompanyId = scope === 'client' ? companyId || null : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex rounded-md border border-[#e2e8f0] bg-white p-0.5" role="group" aria-label="Which list">
          {(['default', 'client'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
              className={cn(
                'rounded px-3 py-1.5 text-[0.8rem] font-medium',
                scope === value ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'text-[#475569] hover:bg-[#f8fafc]'
              )}
            >
              {value === 'default' ? 'Default list' : 'A specific client'}
            </button>
          ))}
        </div>
        {scope === 'client' && (
          <div className="min-w-[260px] flex-1">
            <CompanySelect value={companyId} onChange={setCompanyId} currentUserRole="super_admin" allowQuickCreate={false} />
          </div>
        )}
      </div>

      {scope === 'client' && !companyId ? (
        <p className="text-[0.8rem] text-[#94a3b8]">Pick a client to see or set its onboarding steps.</p>
      ) : (
        <StepListEditor key={listCompanyId ?? 'default'} companyId={listCompanyId} />
      )}
    </div>
  );
}

function StepListEditor({ companyId }: { companyId: string | null }) {
  const query = useOnboardingStepTemplatesQuery(companyId);
  const defaultQuery = useOnboardingStepTemplatesQuery(null);
  const save = useSaveOnboardingStepTemplatesMutation(companyId);
  const [steps, setSteps] = useState<OnboardingStepTemplateDraft[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) setSteps(query.data.steps);
  }, [query.data]);

  const commit = (next: OnboardingStepTemplateDraft[]) => {
    const names = next.map((s) => s.name.trim().toLowerCase());
    if (names.some((n) => !n)) return setError('Every step needs a name');
    if (new Set(names).size !== names.length) return setError('Two steps have the same name');
    setError(null);
    setSteps(next);
    save.mutate(next.map((s) => ({ ...s, name: s.name.trim() })));
  };
  const patch = (index: number, change: Partial<OnboardingStepTemplateDraft>) =>
    steps.map((s, i) => (i === index ? { ...s, ...change } : s));
  const move = (index: number, by: -1 | 1) => {
    const next = [...steps];
    const [row] = next.splice(index, 1);
    next.splice(index + by, 0, row);
    commit(next);
  };

  if (query.isLoading) return <Loader message="Loading onboarding steps…" size="sm" />;
  if (query.isError) return <p className="text-[0.8rem] text-[#dc2626]">Couldn&apos;t load the onboarding steps.</p>;

  const usesDefault = companyId !== null && steps.length === 0;

  return (
    <div className="flex flex-col gap-2">
      {usesDefault && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-[#cbd5e1] p-3 text-[0.8rem] text-[#475569]">
          This client uses the Default list.
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={save.isPending || !defaultQuery.data}
            onClick={() =>
              commit((defaultQuery.data?.steps ?? []).map(({ name, details, requires_attachment, is_active }) => ({ name, details, requires_attachment, is_active })))
            }
          >
            Start from the Default list
          </Button>
          <span className="text-[#94a3b8]">or add this client&apos;s first step below.</span>
        </div>
      )}

      {steps.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {steps.map((step, index) => {
            const isActive = step.is_active !== false;
            return (
              <li
                key={step.id ?? `new-${index}`}
                className={cn('grid grid-cols-1 items-center gap-2 rounded-md border border-[#e2e8f0] bg-white p-2 sm:grid-cols-[24px_1fr_1.4fr_auto]', !isActive && 'opacity-70')}
              >
                <span className="text-center text-[0.8rem] font-semibold text-[#94a3b8]">{index + 1}</span>
                <Input
                  className="h-8"
                  value={step.name}
                  aria-label={`Step ${index + 1} name`}
                  onChange={(e) => setSteps(patch(index, { name: e.target.value }))}
                  onBlur={() => step.name !== query.data?.steps.find((s) => s.id === step.id)?.name && commit(steps)}
                />
                <Input
                  className="h-8"
                  placeholder="Details (optional)"
                  value={step.details ?? ''}
                  aria-label={`Step ${index + 1} details`}
                  onChange={(e) => setSteps(patch(index, { details: e.target.value }))}
                  onBlur={() => (step.details ?? '') !== (query.data?.steps.find((s) => s.id === step.id)?.details ?? '') && commit(steps)}
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[0.75rem] text-[#475569]">
                    <input
                      type="checkbox"
                      checked={!!step.requires_attachment}
                      onChange={(e) => commit(patch(index, { requires_attachment: e.target.checked }))}
                    />
                    Document
                  </label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    aria-label={isActive ? `Deactivate ${step.name}` : `Activate ${step.name}`}
                    onClick={() => commit(patch(index, { is_active: !isActive }))}
                    className={cn('relative inline-flex h-4 w-7 items-center rounded-full transition-colors', isActive ? 'bg-[#2563eb]' : 'bg-[#cbd5e1]')}
                  >
                    <span className={cn('inline-block h-3 w-3 transform rounded-full bg-white transition-transform', isActive ? 'translate-x-3.5' : 'translate-x-0.5')} />
                  </button>
                  {!isActive && <Badge variant="secondary">Inactive</Badge>}
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Move down" disabled={index === steps.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-[#94a3b8] hover:text-[#dc2626]"
                    aria-label={`Remove ${step.name}`}
                    onClick={() => commit(steps.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          commit([...steps, { name: newName.trim(), details: null, requires_attachment: false, is_active: true }]);
          setNewName('');
        }}
      >
        <Input className="h-9 max-w-sm" placeholder="New step, e.g. Collect offer acceptance" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={save.isPending || !newName.trim()}>
          <Plus className="h-3.5 w-3.5" /> Add step
        </Button>
      </form>
      {error && <p className="text-[0.75rem] text-[#dc2626]">{error}</p>}
      <p className="text-[0.72rem] text-[#94a3b8]">
        Steps show to the team in this order, but can be completed in any order. Changes apply to onboardings that have not started yet.
      </p>
    </div>
  );
}
