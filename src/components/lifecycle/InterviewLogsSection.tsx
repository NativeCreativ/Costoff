'use client';

import { formatScheduledDate, formatScheduledTime } from '@/lib/utils';

interface InterviewLogsSectionProps {
  interviews: any[];
  getInterviewStatusStyle: (status: string) => { bg: string; text: string; border: string; dot: string; label: string };
}

export function InterviewLogsSection({ interviews, getInterviewStatusStyle }: InterviewLogsSectionProps) {
  return (
    <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-[18px]">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="m-0 text-[0.95rem] font-bold text-[#7c3aed]">
          <i className="fa-solid fa-calendar-check mr-1.5"></i>
          2. Interview Logs & Feedback ({interviews?.length || 0})
        </h4>
      </div>

      {!interviews || interviews.length === 0 ? (
        <p className="text-[0.82rem] italic text-[#94a3b8]">No interview rounds logged yet for this mandate.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {interviews.map((iv: any, idx: number) => {
            const st = getInterviewStatusStyle(iv.status);
            return (
              <div key={idx} className="rounded-r-lg p-2.5 text-[0.82rem]" style={{ borderLeft: `4px solid ${st.dot}`, backgroundColor: st.bg }}>
                <div className="flex justify-between font-bold" style={{ color: st.text }}>
                  <span>{iv.level} • {iv.candidate_name || 'Candidate'}</span>
                  <span>{st.label}</span>
                </div>
                <div className="mt-1 text-[0.78rem] text-[#475569]">
                  <span><strong>Created By:</strong> {iv.profiles_interviews_created_byToprofiles?.full_name || iv.created_by_name || '—'}</span> | <span><strong>Skill:</strong> {iv.skill_tested}</span>
                </div>
                <div className="mt-0.5 text-[0.75rem] text-[#64748b]">
                  <i className="fa-regular fa-calendar mr-1"></i>{iv.scheduled_date ? formatScheduledDate(iv.scheduled_date) : '—'} at {iv.scheduled_time ? formatScheduledTime(iv.scheduled_time) : '—'} ({iv.mode})
                </div>
                {iv.feedback && (
                  <div className="mt-1.5 rounded border border-[#e2e8f0] bg-white p-1.5 italic text-[#334155]">
                    <i className="fa-regular fa-comment mr-1"></i>Feedback: {iv.feedback}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
