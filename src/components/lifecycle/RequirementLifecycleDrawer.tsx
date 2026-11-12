'use client';

import { LifecycleOverviewPanel } from './LifecycleOverviewPanel';
import { AssignedCandidatesSection } from './AssignedCandidatesSection';
import { InterviewLogsSection } from './InterviewLogsSection';
import { OffersOnboardingsSection } from './OffersOnboardingsSection';

interface LifecycleDrawerState {
  open: boolean;
  requestId: string | null;
  data: any | null;
  loading: boolean;
}

interface RequirementLifecycleDrawerProps {
  lifecycleDrawer: LifecycleDrawerState;
  setLifecycleDrawer: (v: LifecycleDrawerState) => void;
  openAssignModal: (demandId: string, requestId: string) => void;
  handleUpdateSubmissionStage: (submissionId: string, newStage: string) => void;
  getInterviewStatusStyle: (status: string) => { bg: string; text: string; border: string; dot: string; label: string };
}

export function RequirementLifecycleDrawer({
  lifecycleDrawer, setLifecycleDrawer, openAssignModal, handleUpdateSubmissionStage, getInterviewStatusStyle
}: RequirementLifecycleDrawerProps) {
  const handleAssignClick = () => openAssignModal(lifecycleDrawer.data.demand.id, lifecycleDrawer.requestId!);

  return (
    <div
      onClick={() => setLifecycleDrawer({ ...lifecycleDrawer, open: false })}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(15,23,42,0.75)] p-4 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92vh] w-[96vw] max-w-[1600px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e293b] bg-[#0f172a] px-6 py-4 text-white">
          <div>
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-layer-group text-[1.2rem] text-[#38bdf8]"></i>
              <h2 className="m-0 text-[1.2rem] font-bold text-[#f8fafc]">Requirement Full Lifecycle Workspace</h2>
              <span className="rounded-xl border border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.15)] px-2.5 py-0.5 text-[0.8rem] font-bold text-[#38bdf8]">
                {lifecycleDrawer.requestId}
              </span>
            </div>
            <div className="mt-0.5 text-[0.8rem] text-[#94a3b8]">
              Mandate Tracking & Candidate Stage Progression
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lifecycleDrawer.data?.demand && (
              <button
                onClick={handleAssignClick}
                className="flex items-center gap-1.5 rounded-md border-none bg-[#2563eb] px-4 py-2 text-[0.85rem] font-semibold text-white cursor-pointer"
              >
                <i className="fa-solid fa-user-plus"></i> + Assign Candidates
              </button>
            )}
            <button
              onClick={() => setLifecycleDrawer({ ...lifecycleDrawer, open: false })}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-none bg-white/10 text-[1.1rem] text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Workspace Body */}
        <div className="flex flex-1 overflow-hidden">
          {lifecycleDrawer.loading ? (
            <div className="flex flex-1 flex-col items-center justify-center p-[60px] text-center text-[#64748b]">
              <i className="fa-solid fa-spinner fa-spin mb-4 text-[2.5rem] text-[#2563eb]"></i>
              <p className="text-[1.1rem] font-semibold">Fetching Full Requirement Lifecycle Data...</p>
            </div>
          ) : !lifecycleDrawer.data?.demand ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-[#dc2626]">
              <i className="fa-solid fa-circle-exclamation mb-3 text-[2.5rem]"></i>
              <p className="text-base font-semibold">Could not load lifecycle for Request ID {lifecycleDrawer.requestId}</p>
            </div>
          ) : (
            <>
              <LifecycleOverviewPanel
                demand={lifecycleDrawer.data.demand}
                submissionsCount={lifecycleDrawer.data.submissions?.length || 0}
                interviewsCount={lifecycleDrawer.data.interviews?.length || 0}
                offersCount={lifecycleDrawer.data.offers?.length || 0}
                onboardingsCount={lifecycleDrawer.data.onboardings?.length || 0}
              />

              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
                <AssignedCandidatesSection
                  submissions={lifecycleDrawer.data.submissions}
                  onAssignClick={handleAssignClick}
                  handleUpdateSubmissionStage={handleUpdateSubmissionStage}
                  canManage={!!lifecycleDrawer.data.can_manage_pipeline}
                />
                <InterviewLogsSection
                  interviews={lifecycleDrawer.data.interviews}
                  getInterviewStatusStyle={getInterviewStatusStyle}
                />
                <OffersOnboardingsSection
                  offers={lifecycleDrawer.data.offers}
                  onboardings={lifecycleDrawer.data.onboardings}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3">
          <div className="text-[0.8rem] text-[#64748b]">Costaff Enterprise ATS — Requisition & Candidate Lifecycle Management</div>
          <button
            onClick={() => setLifecycleDrawer({ ...lifecycleDrawer, open: false })}
            className="rounded-md border-none bg-[#0f172a] px-5 py-2 text-[0.85rem] font-semibold text-white cursor-pointer"
          >
            Close Fullscreen Workspace
          </button>
        </div>
      </div>
    </div>
  );
}
