'use client';

interface AssignModalState {
  open: boolean;
  demandId: string | null;
  requestId: string | null;
  search: string;
  selectedCids: string[];
  loading: boolean;
  repoCandidates: any[];
  submitting: boolean;
}

interface CandidateBatchAssignModalProps {
  assignModal: AssignModalState;
  setAssignModal: (updater: AssignModalState | ((prev: AssignModalState) => AssignModalState)) => void;
  handleBatchAssignCandidates: () => void;
}

export function CandidateBatchAssignModal({ assignModal, setAssignModal, handleBatchAssignCandidates }: CandidateBatchAssignModalProps) {
  return (
    <div
      onClick={() => setAssignModal({ ...assignModal, open: false })}
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(15,23,42,0.7)] p-5 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-[700px] max-w-[95vw] flex-col overflow-hidden rounded-xl bg-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.3)]"
      >
        <div className="flex items-center justify-between bg-[#0f172a] px-5 py-4 text-white">
          <div>
            <h3 className="m-0 text-[1.05rem] font-bold text-white">Assign Candidates to Mandate ({assignModal.requestId})</h3>
            <div className="mt-0.5 text-[0.78rem] text-[#94a3b8]">Select candidates from repository (20-30 candidates batch)</div>
          </div>
          <button onClick={() => setAssignModal({ ...assignModal, open: false })} className="cursor-pointer border-none bg-transparent text-[1.2rem] text-white">✕</button>
        </div>

        <div className="flex items-center gap-2.5 border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3.5">
          <input
            type="text"
            placeholder="Search candidates by name, email, phone, location..."
            value={assignModal.search}
            onChange={(e) => setAssignModal({ ...assignModal, search: e.target.value })}
            className="flex-1 rounded-md border border-[#cbd5e1] px-3 py-2 text-[0.85rem]"
          />
          <button
            type="button"
            onClick={() => {
              const filtered = assignModal.repoCandidates
                .filter(c => !assignModal.search || c.full_name?.toLowerCase().includes(assignModal.search.toLowerCase()))
                .map(c => c.id);
              setAssignModal({ ...assignModal, selectedCids: filtered });
            }}
            className="cursor-pointer rounded-md border-none bg-[#e2e8f0] px-3 py-2 text-[0.8rem] font-semibold text-[#334155]"
          >
            Select All Filtered
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {assignModal.loading ? (
            <div className="p-10 text-center text-[#64748b]">
              <i className="fa-solid fa-spinner fa-spin mb-2.5 text-[1.8rem] text-[#2563eb]"></i>
              <p>Loading candidate repository...</p>
            </div>
          ) : assignModal.repoCandidates.length === 0 ? (
            <div className="p-[30px] text-center text-[#64748b]">No candidates available in repository.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {assignModal.repoCandidates
                .filter(c => !assignModal.search || (c.full_name + ' ' + c.email + ' ' + c.phone + ' ' + c.current_location).toLowerCase().includes(assignModal.search.toLowerCase()))
                .map((cand: any) => {
                  const isSelected = assignModal.selectedCids.includes(cand.id);
                  return (
                    <label
                      key={cand.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 ${isSelected ? 'border-[#3b82f6] bg-[#eff6ff]' : 'border-[#e2e8f0] bg-white'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignModal({ ...assignModal, selectedCids: [...assignModal.selectedCids, cand.id] });
                          } else {
                            setAssignModal({ ...assignModal, selectedCids: assignModal.selectedCids.filter(id => id !== cand.id) });
                          }
                        }}
                        className="h-4 w-4"
                        style={{ accentColor: '#2563eb' }}
                      />
                      <div className="flex-1">
                        <div className="text-[0.85rem] font-bold text-[#0f172a]">{cand.full_name}</div>
                        <div className="text-[0.78rem] text-[#64748b]">{cand.email || 'No Email'} | {cand.phone || 'No Phone'} | 📍 {cand.current_location || 'N/A'}</div>
                      </div>
                      <div className="text-[0.78rem] font-semibold text-[#0369a1]">
                        {cand.current_ctc ? `₹${cand.current_ctc} LPA` : 'N/A'}
                      </div>
                    </label>
                  );
                })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-3.5">
          <div className="text-[0.82rem] font-bold text-[#2563eb]">
            Selected Candidates: {assignModal.selectedCids.length}
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setAssignModal({ ...assignModal, open: false })}
              className="cursor-pointer rounded-md border border-[#cbd5e1] bg-white px-4 py-2 text-[0.85rem]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={assignModal.selectedCids.length === 0 || assignModal.submitting}
              onClick={handleBatchAssignCandidates}
              className={`cursor-pointer rounded-md border-none px-[18px] py-2 text-[0.85rem] font-bold text-white ${assignModal.selectedCids.length === 0 ? 'bg-[#94a3b8]' : 'bg-[#2563eb]'}`}
            >
              {assignModal.submitting ? 'Assigning...' : `Assign ${assignModal.selectedCids.length} Candidate(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
