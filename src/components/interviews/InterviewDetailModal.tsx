'use client';

import { Interview } from '../types';
import { formatScheduledDate, formatScheduledTime } from '@/lib/utils';

interface InterviewDetailModalProps {
  selectedInterview: Interview;
  setSelectedInterview: (v: Interview | null) => void;
}

/** Strictly read-only — no Edit action, no status-changing controls. Status/Round/Mode
 *  changes happen via the table's inline editing or the separate Edit modal. */
export function InterviewDetailModal({ selectedInterview, setSelectedInterview }: InterviewDetailModalProps) {
  const createdByProfile = selectedInterview.profiles_interviews_created_byToprofiles;
  const createdByName = createdByProfile?.full_name || selectedInterview.created_by_name;
  const createdByEmail = createdByProfile?.email || selectedInterview.created_by_email;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(15,23,42,0.65)] backdrop-blur-md">
      <div className="w-[520px] rounded-xl bg-white p-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.15)]">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <span className="text-[0.75rem] font-bold uppercase tracking-[0.5px] text-[#2563eb]">Interview Slot Details</span>
            <h2 className="mt-0.5 text-[1.2rem] font-extrabold text-[#0f172a]">{selectedInterview.candidate_name || 'Candidate Interview'}</h2>
          </div>
          <button onClick={() => setSelectedInterview(null)} className="cursor-pointer border-none bg-none text-[1.3rem] text-[#64748b]">×</button>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
          <div className="grid grid-cols-2 gap-2.5 text-[0.84rem]">
            <div><span className="text-[#64748b]">Request ID:</span> <strong className="text-[#2563eb]">{selectedInterview.demand_request_id || '—'}</strong></div>
            <div><span className="text-[#64748b]">Interview Round:</span> <strong>{selectedInterview.level}</strong></div>
            <div><span className="text-[#64748b]">Created By:</span> <strong>{createdByName || '—'}{createdByEmail ? ` (${createdByEmail})` : ''}</strong></div>
            <div><span className="text-[#64748b]">Mode:</span> <strong>{selectedInterview.mode}</strong></div>
            <div><span className="text-[#64748b]">Status:</span> <strong>{selectedInterview.status}</strong></div>
            <div><span className="text-[#64748b]">Date & Time:</span> <strong>{selectedInterview.scheduled_date ? formatScheduledDate(selectedInterview.scheduled_date) : '—'} at {selectedInterview.scheduled_time ? formatScheduledTime(selectedInterview.scheduled_time) : '—'}{selectedInterview.end_time ? ` – ${formatScheduledTime(selectedInterview.end_time)}` : ''}</strong></div>
            {selectedInterview.result && (
              <div><span className="text-[#64748b]">Result:</span> <strong>{selectedInterview.result}</strong></div>
            )}
            {selectedInterview.link_status && (
              <div><span className="text-[#64748b]">Link Status:</span> <strong>{selectedInterview.link_status}</strong></div>
            )}
          </div>

          {selectedInterview.meeting_link && (
            <div className="mt-1.5 border-t border-[#e2e8f0] pt-2.5">
              <a href={selectedInterview.meeting_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-[#2563eb] px-3.5 py-1.5 text-[0.8rem] font-semibold text-white no-underline">
                <i className="fa-solid fa-video"></i> Join Video Interview Call
              </a>
            </div>
          )}

          {selectedInterview.feedback && (
            <div className="border-t border-[#e2e8f0] pt-2.5 text-[0.82rem] text-[#475569]">
              <span className="text-[#64748b]">Feedback:</span> {selectedInterview.feedback}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
