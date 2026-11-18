'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatScheduledDate, formatScheduledTime } from '@/lib/utils';
import { candidateUrgency } from '@/lib/candidates/candidateUrgency';
import { CandidateConversationLog } from './CandidateConversationLog';

interface CandidateDrawerState {
  open: boolean;
  candidateId: string | null;
  data: any | null;
  loading: boolean;
}

interface CandidateHistoryDrawerProps {
  candidateDrawer: CandidateDrawerState;
  setCandidateDrawer: (v: CandidateDrawerState) => void;
  openLifecycle: (reqId: string) => void;
  getInterviewStatusStyle: (status: string) => { bg: string; text: string; border: string; dot: string; label: string };
}

export function CandidateHistoryDrawer({ candidateDrawer, setCandidateDrawer, openLifecycle, getInterviewStatusStyle }: CandidateHistoryDrawerProps) {
  const drawerUrgency = candidateDrawer.data?.candidate ? candidateUrgency(candidateDrawer.data.candidate) : null;
  return (
    <div
      onClick={() => setCandidateDrawer({ ...candidateDrawer, open: false })}
      className="fixed inset-0 z-[2000] flex justify-end bg-[rgba(15,23,42,0.65)] backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[560px] max-w-[90vw] flex-col bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.25)]"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between bg-[#0f172a] px-6 py-5 text-white">
          <div>
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-user-gear text-[#38bdf8]"></i>
              <h2 className="text-[1.1rem] font-bold text-[#f8fafc]">Candidate 360 Profile & History</h2>
            </div>
            <div className="mt-0.5 text-[0.8rem] text-[#94a3b8]">
              Candidate: <span className="font-bold text-[#38bdf8]">{candidateDrawer.data?.candidate?.full_name || 'Loading...'}</span>
            </div>
          </div>
          <button
            onClick={() => setCandidateDrawer({ ...candidateDrawer, open: false })}
            className="flex h-8 w-8 items-center justify-center rounded-full border-none bg-white/10 text-[1.1rem] text-white cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {candidateDrawer.loading ? (
            <div className="p-[60px] text-center text-[#64748b]">
              <i className="fa-solid fa-spinner fa-spin mb-3 text-2xl text-[#2563eb]"></i>
              <p className="font-semibold">Fetching Candidate Profile & Application History...</p>
            </div>
          ) : !candidateDrawer.data?.candidate ? (
            <div className="p-10 text-center text-[#dc2626]">
              <i className="fa-solid fa-circle-exclamation mb-2.5 text-2xl"></i>
              <p>Could not load candidate profile details.</p>
            </div>
          ) : (
            <>
              {/* Step 1: Candidate Personal & Contact Information Card */}
              <div className="rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">
                    <i className="fa-solid fa-address-card"></i> Candidate Contact & Professional Details
                  </span>
                  <Badge className="border-transparent bg-[#eff6ff] text-[0.75rem] font-bold text-[#2563eb] hover:bg-[#eff6ff]">
                    {candidateDrawer.data.candidate.source || 'Naukri'}
                  </Badge>
                </div>

                <h3 className="mb-2.5 text-[1.1rem] font-extrabold text-[#0f172a]">
                  {candidateDrawer.data.candidate.full_name}
                </h3>

                <div className="grid grid-cols-2 gap-2.5 text-[0.82rem] text-[#334155]">
                  <div><i className="fa-solid fa-phone w-4 text-[#64748b]"></i> <strong>Phone:</strong> {candidateDrawer.data.candidate.phone || '—'}</div>
                  <div><i className="fa-regular fa-envelope w-4 text-[#64748b]"></i> <strong>Email:</strong> {candidateDrawer.data.candidate.email || '—'}</div>
                  <div><i className="fa-solid fa-building w-4 text-[#64748b]"></i> <strong>Current Company:</strong> {candidateDrawer.data.candidate.current_company || '—'}</div>
                  <div><i className="fa-solid fa-location-dot w-4 text-[#64748b]"></i> <strong>Location:</strong> {candidateDrawer.data.candidate.current_location || '—'}</div>
                  <div><i className="fa-solid fa-indian-rupee-sign w-4 text-[#64748b]"></i> <strong>Current CTC:</strong> {candidateDrawer.data.candidate.current_ctc ? `₹${candidateDrawer.data.candidate.current_ctc} LPA` : '—'}</div>
                  <div><i className="fa-solid fa-bullseye w-4 text-[#64748b]"></i> <strong>Expected CTC:</strong> {candidateDrawer.data.candidate.expected_ctc ? `₹${candidateDrawer.data.candidate.expected_ctc} LPA` : '—'}</div>
                  <div><i className="fa-solid fa-hourglass-half w-4 text-[#64748b]"></i> <strong>Notice Period:</strong> {candidateDrawer.data.candidate.availability || 'Immediate'}</div>
                  <div>
                    <i className="fa-solid fa-handshake w-4 text-[#64748b]"></i> <strong>Offer in Hand:</strong>{' '}
                    {candidateDrawer.data.candidate.offer_in_hand
                      ? [
                          candidateDrawer.data.candidate.offer_company,
                          candidateDrawer.data.candidate.offer_ctc ? `₹${candidateDrawer.data.candidate.offer_ctc}` : null,
                          candidateDrawer.data.candidate.offer_doj ? `DOJ ${formatDate(candidateDrawer.data.candidate.offer_doj)}` : null,
                        ].filter(Boolean).join(' · ') || 'Yes'
                      : 'No'}
                  </div>
                  {drawerUrgency && (
                    <div className={drawerUrgency.level === 'high' ? 'font-semibold text-[#b91c1c]' : 'font-semibold text-[#92400e]'}>
                      <i className="fa-solid fa-triangle-exclamation w-4"></i> {drawerUrgency.label}: {drawerUrgency.reason}
                    </div>
                  )}
                  <div><i className="fa-regular fa-calendar-check w-4 text-[#64748b]"></i> <strong>Added Date:</strong> {candidateDrawer.data.candidate.created_at ? formatDate(candidateDrawer.data.candidate.created_at) : 'Recent'}</div>
                  {candidateDrawer.data.candidate.alternate_email && <div><strong>Alternate Email:</strong> {candidateDrawer.data.candidate.alternate_email}</div>}
                  {candidateDrawer.data.candidate.date_of_birth && <div><strong>Date of Birth:</strong> {formatDate(candidateDrawer.data.candidate.date_of_birth)}</div>}
                  {candidateDrawer.data.candidate.relevant_experience && <div><strong>Relevant Experience:</strong> {candidateDrawer.data.candidate.relevant_experience}</div>}
                  {candidateDrawer.data.candidate.core_specialization && <div><strong>Core Specialization:</strong> {candidateDrawer.data.candidate.core_specialization}</div>}
                  {candidateDrawer.data.candidate.employee_id && <div><strong>Employee ID:</strong> {candidateDrawer.data.candidate.employee_id}</div>}
                  {candidateDrawer.data.candidate.duration_in_role && <div><strong>In Current Role:</strong> {candidateDrawer.data.candidate.duration_in_role}</div>}
                  {candidateDrawer.data.candidate.last_working_day && <div><strong>Last Working Day:</strong> {formatDate(candidateDrawer.data.candidate.last_working_day)}</div>}
                  {candidateDrawer.data.candidate.pan_last4 && <div><strong>PAN:</strong> <span className="font-mono">XXXXXX{candidateDrawer.data.candidate.pan_last4}</span></div>}
                  <div><strong>RTR:</strong> {candidateDrawer.data.candidate.rtr_acknowledged ? 'Received' : 'Not received'}{candidateDrawer.data.candidate.rtr_note ? ` · ${candidateDrawer.data.candidate.rtr_note}` : ''}
                    {candidateDrawer.data.candidate.rtr_file_url && <> · <a href={candidateDrawer.data.candidate.rtr_file_url} target="_blank" rel="noopener noreferrer" className="text-[#2563eb] hover:underline">file</a></>}
                  </div>
                  {candidateDrawer.data.candidate.resume_url && (
                    <div><strong>Resume:</strong> <a href={candidateDrawer.data.candidate.resume_url} target="_blank" rel="noopener noreferrer" className="text-[#2563eb] hover:underline">{candidateDrawer.data.candidate.resume_file_name || 'Open'}</a></div>
                  )}
                  {candidateDrawer.data.candidate.reason_for_change && <div className="col-span-2"><strong>Reason for Change:</strong> {candidateDrawer.data.candidate.reason_for_change}</div>}
                  {candidateDrawer.data.candidate.other_details && <div className="col-span-2 whitespace-pre-line"><strong>Other Details:</strong> {candidateDrawer.data.candidate.other_details}</div>}
                </div>

                {/* BELONGING REQUEST ID(S) BADGE */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2.5">
                  <span className="text-[0.8rem] font-bold text-[#1e40af]">
                    <i className="fa-solid fa-file-signature mr-1.5"></i>Belonging Request ID(s):
                  </span>
                  {candidateDrawer.data.linkedRequestIds && candidateDrawer.data.linkedRequestIds.length > 0 ? (
                    candidateDrawer.data.linkedRequestIds.map((reqId: string, idx: number) => (
                      <Button
                        key={idx}
                        onClick={() => {
                          setCandidateDrawer({ ...candidateDrawer, open: false });
                          openLifecycle(reqId);
                        }}
                        title="Click to view full Requirement Lifecycle"
                        className="h-auto gap-1 rounded-md px-2.5 py-1 text-[0.78rem] font-bold"
                      >
                        <i className="fa-solid fa-clock-rotate-left text-[0.7rem]"></i> {reqId}
                      </Button>
                    ))
                  ) : (
                    <span className="text-[0.78rem] italic text-[#64748b]">Unmapped / General Candidate Pool</span>
                  )}
                </div>
              </div>

              <CandidateConversationLog candidateId={candidateDrawer.data.candidate.id} />

              {/* Step 2: Mapped Demands & Interview History */}
              <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#7c3aed]">
                    <i className="fa-solid fa-list-check"></i> Mapped Requirements & Interview Rounds ({candidateDrawer.data.interviews?.length || 0})
                  </span>
                </div>

                {!candidateDrawer.data.interviews || candidateDrawer.data.interviews.length === 0 ? (
                  <p className="text-[0.82rem] italic text-[#94a3b8]">No interview rounds or mandate mappings recorded for this candidate yet.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {candidateDrawer.data.interviews.map((iv: any, idx: number) => {
                      const st = getInterviewStatusStyle(iv.status);
                      return (
                        <div key={idx} className="rounded-r-lg p-2.5 text-[0.82rem]" style={{ borderLeft: `4px solid ${st.dot}`, backgroundColor: st.bg }}>
                          <div className="flex justify-between font-bold" style={{ color: st.text }}>
                            <span>
                              <button
                                onClick={() => {
                                  setCandidateDrawer({ ...candidateDrawer, open: false });
                                  openLifecycle(iv.demand_request_id);
                                }}
                                className="cursor-pointer border-none bg-none p-0 text-[0.82rem] font-bold text-[#2563eb] underline"
                              >
                                {iv.demand_request_id}
                              </button> — {iv.level} Round
                            </span>
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

              {/* Step 3: Candidate Offers History */}
              <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#059669]">
                    <i className="fa-solid fa-gift"></i> Offer History ({candidateDrawer.data.offers?.length || 0})
                  </span>
                </div>

                {!candidateDrawer.data.offers || candidateDrawer.data.offers.length === 0 ? (
                  <p className="text-[0.82rem] italic text-[#94a3b8]">No offers issued to this candidate yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {candidateDrawer.data.offers.map((off: any, idx: number) => (
                      <div key={idx} className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-2.5 text-[0.82rem]">
                        <div className="flex justify-between font-bold text-[#166534]">
                          <span>Req ID: {off.demands?.request_id || 'Requirement'}</span>
                          <span>Status: {off.status}</span>
                        </div>
                        <div className="mt-1 text-[0.78rem] text-[#15803d]">
                          Offered CTC: <strong>₹{off.offered_ctc} LPA</strong> | Offer Date: {off.offer_date ? formatScheduledDate(off.offer_date) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 4: Candidate Onboarding History */}
              <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#0284c7]">
                    <i className="fa-solid fa-user-check"></i> Onboarding & BGV Verification ({candidateDrawer.data.onboardings?.length || 0})
                  </span>
                </div>

                {!candidateDrawer.data.onboardings || candidateDrawer.data.onboardings.length === 0 ? (
                  <p className="text-[0.82rem] italic text-[#94a3b8]">No onboarding or BGV record logged for this candidate yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {candidateDrawer.data.onboardings.map((ob: any, idx: number) => (
                      <div key={idx} className="rounded-lg border border-[#bae6fd] bg-[#f0f9ff] p-2.5 text-[0.82rem]">
                        <div className="flex justify-between font-bold text-[#0369a1]">
                          <span>Req ID: {ob.demands?.request_id || 'Requirement'}</span>
                          <span>BGV: {ob.bgv_status?.toUpperCase()}</span>
                        </div>
                        <div className="mt-1 text-[0.78rem] text-[#0284c7]">
                          Joining Date: <strong>{ob.actual_joining_date ? formatScheduledDate(ob.actual_joining_date) : 'TBD'}</strong> | Status: {ob.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="flex justify-end border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-4">
          <Button
            onClick={() => setCandidateDrawer({ ...candidateDrawer, open: false })}
            className="h-auto rounded-md bg-[#0f172a] px-5 py-2 text-[0.85rem] font-semibold hover:bg-[#0f172a]/90"
          >
            Close Candidate Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
