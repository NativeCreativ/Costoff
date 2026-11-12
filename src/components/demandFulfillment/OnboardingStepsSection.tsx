'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Circle, FileText, Paperclip, X } from 'lucide-react';
import { FormSelect } from '@/components/ui/FormSelect';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/Loader';
import { cn, formatDate } from '@/lib/utils';
import {
  ONBOARDING_STEP_STATUS_LABELS,
  ONBOARDING_STEP_STATUS_VALUES,
  isOnboardingStepDone,
} from '@/lib/onboarding/onboardingSteps';
import {
  useOnboardingStepsQuery,
  useUpdateOnboardingStepMutation,
  useUploadOnboardingStepFileMutation,
} from '@/queries/onboarding/useOnboardingSteps';
import type { OnboardingStep } from '@/services/demandFulfillment.service';

const STATUS_OPTIONS = ONBOARDING_STEP_STATUS_VALUES.map((value) => ({ value, label: ONBOARDING_STEP_STATUS_LABELS[value] }));

interface OnboardingStepsSectionProps {
  requestId: string;
  onboardingId: string;
  canManage: boolean;
}

/**
 * The candidate's ordered onboarding steps (copied from the client's step list on first open).
 * Order is guidance only — any step can be updated at any time — and progress counts Completed
 * and Not applicable steps as done.
 */
export function OnboardingStepsSection({ requestId, onboardingId, canManage }: OnboardingStepsSectionProps) {
  const stepsQuery = useOnboardingStepsQuery(onboardingId);
  const steps = stepsQuery.data?.steps ?? [];
  const done = steps.filter((step) => isOnboardingStepDone(step.status)).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#475569]">Onboarding Steps</div>
        {steps.length > 0 && (
          <span className="text-[0.75rem] font-semibold text-[#64748b]">
            {done} of {steps.length} done
          </span>
        )}
      </div>
      {stepsQuery.isLoading ? (
        <Loader message="Loading onboarding steps…" size="sm" />
      ) : stepsQuery.isError ? (
        <div className="text-[0.8rem] text-[#dc2626]">Couldn&apos;t load the onboarding steps.</div>
      ) : steps.length === 0 ? (
        <div className="text-[0.8rem] text-[#94a3b8]">
          No onboarding steps are configured for this client. Add them in Master Data → Onboarding Steps.
        </div>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {steps.map((step, index) => (
            <OnboardingStepRow
              key={step.id}
              step={step}
              index={index}
              requestId={requestId}
              onboardingId={onboardingId}
              canManage={canManage}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function OnboardingStepRow({
  step,
  index,
  requestId,
  onboardingId,
  canManage,
}: {
  step: OnboardingStep;
  index: number;
  requestId: string;
  onboardingId: string;
  canManage: boolean;
}) {
  const update = useUpdateOnboardingStepMutation(onboardingId, requestId);
  const upload = useUploadOnboardingStepFileMutation(onboardingId, requestId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [remark, setRemark] = useState(step.remark ?? '');
  const isDone = isOnboardingStepDone(step.status);
  const missingFile = step.requires_attachment && !step.attachment_url && step.status !== 'not_applicable';

  const saveRemark = () => {
    if ((remark.trim() || null) === (step.remark || null)) return;
    update.mutate({ stepId: step.id, payload: { remark: remark.trim() || null } });
  };

  return (
    <li className={cn('rounded-md border border-[#e2e8f0] px-3 py-2', isDone && 'bg-[#f8fafc]')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {isDone ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#cbd5e1]" />}
          <div className="min-w-0">
            <div className="text-[0.82rem] font-semibold text-[#0f172a]">
              {index + 1}. {step.name}
              {step.requires_attachment && <span className="ml-1 text-[0.7rem] font-normal text-[#64748b]">(document)</span>}
            </div>
            {step.details && <div className="text-[0.76rem] text-[#64748b]">{step.details}</div>}
            {step.completed_at && step.status === 'completed' && (
              <div className="text-[0.7rem] text-[#94a3b8]">
                Completed {formatDate(step.completed_at)}
                {step.updated_by_name ? ` · ${step.updated_by_name}` : ''}
              </div>
            )}
          </div>
        </div>
        {canManage ? (
          <div className="w-[150px] shrink-0">
            <FormSelect
              label=""
              small
              options={STATUS_OPTIONS}
              value={step.status}
              disabled={update.isPending}
              onChange={(status) => update.mutate({ stepId: step.id, payload: { status } })}
            />
          </div>
        ) : (
          <Badge variant="secondary">{ONBOARDING_STEP_STATUS_LABELS[step.status as keyof typeof ONBOARDING_STEP_STATUS_LABELS] ?? step.status}</Badge>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-6">
        {step.attachment_url ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-2 py-0.5 text-[0.75rem]">
            <FileText className="h-3.5 w-3.5 text-[#2563eb]" />
            <a href={step.attachment_url} target="_blank" rel="noopener noreferrer" className="max-w-[220px] truncate font-medium text-[#2563eb] hover:underline">
              {step.attachment_name || 'Document'}
            </a>
            {canManage && (
              <button
                type="button"
                aria-label={`Remove the file from ${step.name}`}
                className="text-[#94a3b8] hover:text-[#dc2626]"
                onClick={() => update.mutate({ stepId: step.id, payload: { clear_attachment: true } })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ) : missingFile ? (
          <span className="text-[0.72rem] text-[#b45309]">Document not attached yet</span>
        ) : null}
        {canManage && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[0.72rem]"
              disabled={upload.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="h-3 w-3" />
              {upload.isPending ? 'Uploading…' : step.attachment_url ? 'Replace' : 'Attach'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              aria-label={`Attach a file to ${step.name}`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate({ stepId: step.id, file });
                e.target.value = '';
              }}
            />
            <Input
              value={remark}
              placeholder="Remark"
              onChange={(e) => setRemark(e.target.value)}
              onBlur={saveRemark}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveRemark();
                }
              }}
              className="h-6 min-w-[140px] flex-1 rounded-md border-[#e2e8f0] px-2 text-[0.75rem] shadow-none"
            />
          </>
        )}
        {!canManage && step.remark && <span className="text-[0.75rem] text-[#64748b]">{step.remark}</span>}
      </div>
    </li>
  );
}
