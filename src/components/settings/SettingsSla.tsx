'use client';

import { SlaConfig } from '../types';

interface SettingsSlaProps {
  slaConfig: SlaConfig;
  setSlaConfig: (v: SlaConfig) => void;
}

export function SettingsSla({ slaConfig, setSlaConfig }: SettingsSlaProps) {
  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)] p-6">
        <h2 className="mb-4 text-base font-bold"><i className="fa-solid fa-flag mr-2 text-[#dc2626]"></i>30-Day Aging & SLA Rules</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">Red Flag Days Threshold</label>
            <input type="number" value={slaConfig.redFlagDaysThreshold} onChange={(e) => setSlaConfig({ ...slaConfig, redFlagDaysThreshold: parseInt(e.target.value) || 30 })} className="w-full rounded-md border border-[#e2e8f0] px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">Intake to Allocation SLA (Days)</label>
            <input type="number" value={slaConfig.intakeToAllocationSlaDays} onChange={(e) => setSlaConfig({ ...slaConfig, intakeToAllocationSlaDays: parseInt(e.target.value) || 2 })} className="w-full rounded-md border border-[#e2e8f0] px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">TA Submission to Client SLA (Days)</label>
            <input type="number" value={slaConfig.submissionToClientSlaDays} onChange={(e) => setSlaConfig({ ...slaConfig, submissionToClientSlaDays: parseInt(e.target.value) || 1 })} className="w-full rounded-md border border-[#e2e8f0] px-3 py-2" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)] p-6">
        <h2 className="mb-4 text-base font-bold"><i className="fa-solid fa-hashtag mr-2 text-[#2563eb]"></i>ID & Numbering Schemes</h2>
        <div className="flex flex-col gap-3">
          <div className="rounded-md bg-[#f8fafc] p-3">
            <span className="text-[0.78rem] text-[#64748b]">Current Demand ID Format Syntax:</span>
            <p className="mt-1 text-[1.2rem] font-extrabold text-[#2563eb]">CSF-2026-NNNN</p>
          </div>
        </div>
      </div>
    </div>
  );
}
