'use client';

import { useState } from 'react';
import { Calendar, Save, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/Loader';
import { useToast } from '@/components/ui/Toast';
import { useWorkingDaysQuery, useSaveWorkingDayMutation } from '@/queries/settings/useWorkingDaysQueries';
import type { WorkingDayMonth } from '@/services/workingDays.service';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function WorkingDaysSection() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const { data, isLoading } = useWorkingDaysQuery(selectedYear);
  const saveMutation = useSaveWorkingDayMutation();
  const toast = useToast();

  const [editingRows, setEditingRows] = useState<Record<number, { working_days: number; holidays_count: number; notes: string }>>({});
  const [savingMonth, setSavingMonth] = useState<number | null>(null);

  const months: WorkingDayMonth[] = data?.months ?? [];

  const getRowValues = (m: WorkingDayMonth) => {
    return editingRows[m.month] ?? {
      working_days: m.working_days,
      holidays_count: m.holidays_count,
      notes: m.notes || '',
    };
  };

  const handleFieldChange = (month: number, field: 'working_days' | 'holidays_count' | 'notes', value: any) => {
    const current = months.find((m) => m.month === month);
    const existing = editingRows[month] ?? {
      working_days: current?.working_days ?? 22,
      holidays_count: current?.holidays_count ?? 0,
      notes: current?.notes ?? '',
    };
    setEditingRows({
      ...editingRows,
      [month]: {
        ...existing,
        [field]: field === 'notes' ? value : Number(value),
      },
    });
  };

  const handleSaveRow = async (month: number) => {
    const current = months.find((m) => m.month === month);
    const values = editingRows[month] ?? {
      working_days: current?.working_days ?? 22,
      holidays_count: current?.holidays_count ?? 0,
      notes: current?.notes ?? '',
    };

    setSavingMonth(month);
    try {
      await saveMutation.mutateAsync({
        year: selectedYear,
        month,
        working_days: values.working_days,
        holidays_count: values.holidays_count,
        notes: values.notes,
      });
      toast.success(`${MONTH_NAMES[month - 1]} updated`);
      // clear local dirty state for this month
      const next = { ...editingRows };
      delete next[month];
      setEditingRows(next);
    } catch {
      toast.error('Failed to save', `Could not update ${MONTH_NAMES[month - 1]}`);
    } finally {
      setSavingMonth(null);
    }
  };

  // Summaries
  const totalWorkingDays = months.reduce((acc, m) => {
    const row = editingRows[m.month] ?? m;
    return acc + (row.working_days || 0);
  }, 0);

  const totalHolidays = months.reduce((acc, m) => {
    const row = editingRows[m.month] ?? m;
    return acc + (row.holidays_count || 0);
  }, 0);

  const avgWorkingDays = (totalWorkingDays / 12).toFixed(1);

  return (
    <div className="flex flex-col gap-5">
      {/* Year Selector & Summary Cards */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#2563eb]" />
          <span className="text-[0.82rem] font-semibold text-[#334155]">Year:</span>
          <div className="flex items-center gap-1.5">
            {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => {
                  setSelectedYear(year);
                  setEditingRows({});
                }}
                className={`rounded-md border px-3 py-1 text-[0.8rem] font-medium transition-colors ${
                  selectedYear === year
                    ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-sm'
                    : 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f8fafc]'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Quick summary badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5">
            <span className="text-[0.72rem] uppercase font-bold text-[#64748b]">Total Working Days:</span>
            <span className="text-[0.88rem] font-extrabold text-[#2563eb]">{totalWorkingDays}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5">
            <span className="text-[0.72rem] uppercase font-bold text-[#64748b]">Total Holidays:</span>
            <span className="text-[0.88rem] font-extrabold text-[#d97706]">{totalHolidays}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5">
            <span className="text-[0.72rem] uppercase font-bold text-[#64748b]">Monthly Avg:</span>
            <span className="text-[0.88rem] font-extrabold text-[#0f172a]">{avgWorkingDays}</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Loader message="Loading working days configuration…" size="sm" className="p-8" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.82rem]">
              <thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[0.72rem] font-bold uppercase tracking-wider text-[#64748b]">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Days in Month</th>
                  <th className="px-4 py-3">Working Days</th>
                  <th className="px-4 py-3">Holidays</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {months.map((m) => {
                  const values = getRowValues(m);
                  const isDirty = !!editingRows[m.month];
                  const daysInMonth = getDaysInMonth(selectedYear, m.month);
                  const isSaving = savingMonth === m.month;

                  return (
                    <tr key={m.month} className="hover:bg-[#fafafa]">
                      <td className="px-4 py-2.5 font-semibold text-[#1e293b]">
                        {MONTH_NAMES[m.month - 1]}
                      </td>
                      <td className="px-4 py-2.5 text-[#64748b]">
                        {daysInMonth}
                      </td>
                      <td className="px-4 py-2.5">
                        <Input
                          type="number"
                          min={0}
                          max={daysInMonth}
                          value={values.working_days}
                          onChange={(e) => handleFieldChange(m.month, 'working_days', e.target.value)}
                          className="h-8 w-24 text-[0.82rem]"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <Input
                          type="number"
                          min={0}
                          max={daysInMonth}
                          value={values.holidays_count}
                          onChange={(e) => handleFieldChange(m.month, 'holidays_count', e.target.value)}
                          className="h-8 w-24 text-[0.82rem]"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <Input
                          type="text"
                          placeholder="Notes / observed holidays"
                          value={values.notes}
                          onChange={(e) => handleFieldChange(m.month, 'notes', e.target.value)}
                          className="h-8 min-w-[200px] text-[0.82rem]"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant={isDirty ? 'default' : 'outline'}
                          onClick={() => handleSaveRow(m.month)}
                          disabled={isSaving}
                          className="h-7 gap-1 px-2.5 text-[0.75rem]"
                        >
                          {isSaving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isDirty ? (
                            <>
                              <Save className="h-3 w-3" /> Save
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3 text-[#16a34a]" /> Saved
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
