'use client';

import { Badge } from '@/components/ui/badge';

interface AssignedCandidatesSectionProps {
  submissions: any[];
  onAssignClick: () => void;
  handleUpdateSubmissionStage: (submissionId: string, newStage: string) => void;
  /**
   * Whether the viewer may change this demand's pipeline. Comes from the lifecycle API's
   * `can_manage_pipeline`, which is the same canManageDemandPipeline predicate
   * POST/PUT /api/submissions enforce — so a read-only role (SPOC / hr / viewer) is shown the
   * stage list but no way to change it, rather than a control the API would reject.
   */
  canManage: boolean;
}

export function AssignedCandidatesSection({ submissions, onAssignClick, handleUpdateSubmissionStage, canManage }: AssignedCandidatesSectionProps) {
  return (
    <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-[18px]">
      <div className="mb-3.5 flex items-center justify-between">
        <div>
          <h4 className="m-0 text-[0.95rem] font-bold text-[#0f172a]">
            <i className="fa-solid fa-users mr-1.5 text-[#2563eb]"></i>
            1. Assigned Candidates & Selection Stages ({submissions?.length || 0})
          </h4>
          <div className="mt-0.5 text-[0.78rem] text-[#64748b]">Track candidate stage progression from Phone Call to Final Selection</div>
        </div>
        {/* Assigning candidates to the pipeline is a mutation — hidden for read-only roles. */}
        {canManage && (
          <button
            onClick={onAssignClick}
            className="cursor-pointer rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1.5 text-[0.8rem] font-bold text-[#2563eb]"
          >
            + Assign Candidates
          </button>
        )}
      </div>

      {!submissions || submissions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-[30px] text-center">
          <i className="fa-solid fa-user-slash mb-2 text-[1.8rem] text-[#94a3b8]"></i>
          <p className="m-0 text-[0.85rem] text-[#64748b]">No candidates assigned to this requisition yet.</p>
          {canManage && (
            <button
              onClick={onAssignClick}
              className="mt-2.5 cursor-pointer rounded-md border-none bg-[#2563eb] px-3.5 py-1.5 text-[0.8rem] font-semibold text-white"
            >
              Assign Candidates
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr className="border-b-2 border-[#e2e8f0] bg-[#f8fafc] text-left text-[#475569]">
                <th className="p-2.5">Candidate Name</th>
                <th className="p-2.5">Contact Details</th>
                <th className="p-2.5">Current CTC / Exp</th>
                <th className="p-2.5">Current Stage</th>
                {canManage && <th className="p-2.5 text-right">Stage Action</th>}
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub: any, idx: number) => {
                const cand = sub.candidates || {};
                return (
                  <tr key={idx} className="border-b border-[#f1f5f9]">
                    <td className="p-2.5 font-bold text-[#0f172a]">
                      {cand.full_name || 'Candidate'}
                      {cand.current_location && <div className="text-[0.74rem] font-normal text-[#64748b]">📍 {cand.current_location}</div>}
                    </td>
                    <td className="p-2.5 text-[#475569]">
                      <div>{cand.email || 'N/A'}</div>
                      <div className="text-[0.76rem] text-[#64748b]">{cand.phone || 'N/A'}</div>
                    </td>
                    <td className="p-2.5 text-[#475569]">
                      <div>{cand.current_ctc ? `₹${cand.current_ctc} LPA` : 'N/A'}</div>
                      <div className="text-[0.74rem] text-[#64748b]">Avail: {cand.availability || 'Immediate'}</div>
                    </td>
                    <td className="p-2.5">
                      <Badge
                        className={`border-transparent text-[0.75rem] font-bold ${
                          sub.stage === 'joined' ? 'bg-[#dcfce7] text-[#166534] hover:bg-[#dcfce7]'
                          : sub.stage === 'offer_issued' ? 'bg-[#dbeafe] text-[#1e40af] hover:bg-[#dbeafe]'
                          : sub.stage === 'rejected' ? 'bg-[#fee2e2] text-[#991b1b] hover:bg-[#fee2e2]'
                          : 'bg-[#fef3c7] text-[#92400e] hover:bg-[#fef3c7]'
                        }`}
                      >
                        {sub.stage?.replace(/_/g, ' ')?.toUpperCase() || 'PHONE CALL DONE'}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-right">
                      {/* Read-only roles see the current stage as text, never a <select>:
                          changing a stage is an edit, and PUT /api/submissions rejects it
                          for anyone who cannot manage this demand's pipeline. */}
                      {canManage ? (
                        <select
                          value={sub.stage || 'phone_call_done'}
                          onChange={(e) => handleUpdateSubmissionStage(sub.id, e.target.value)}
                          className="cursor-pointer rounded-md border border-[#cbd5e1] bg-white px-2 py-1 text-[0.78rem] font-semibold"
                        >
                          <option value="phone_call_done">📞 Phone Call Done</option>
                          <option value="l1_scheduled">🗓️ L1 Interview Scheduled</option>
                          <option value="l1_passed">✅ L1 Round Passed</option>
                          <option value="l2_passed">✅ L2 Round Passed</option>
                          <option value="client_round_passed">🎯 Client Round Passed</option>
                          <option value="offer_issued">📄 Offer Issued</option>
                          <option value="joined">🎉 Joined / Onboarded</option>
                          <option value="rejected">❌ Rejected / Dropped</option>
                        </select>
                      ) : (
                        <span className="text-[0.78rem] font-semibold text-[#64748b]">
                          {sub.stage?.replace(/_/g, ' ')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
