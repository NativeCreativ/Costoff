'use client';

import { useState, useMemo } from 'react';
import { Calculator, ArrowRight, Settings2, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FormSelect } from '@/components/ui/FormSelect';
import {
  RateFormulaConfig,
  DEFAULT_RATE_FORMULA,
  executeRateFormula,
  reverseCalculateRateFromCTC,
  RateBasis,
} from '@/lib/rateConverter/formulaEngine';
import { FormulaCreator } from './FormulaCreator';

interface ContractRateConverterCardProps {
  clientName?: string;
  formula: RateFormulaConfig | null;
  onFormulaChange: (formula: RateFormulaConfig) => void;
  onApplyCompensation: (min: string, max: string) => void;
}

const RATE_TYPE_OPTIONS = [
  { value: 'hourly', label: '/ Hour' },
  { value: 'weekly', label: '/ Week' },
  { value: 'monthly', label: '/ Month' },
];

export function ContractRateConverterCard({
  clientName,
  formula,
  onFormulaChange,
  onApplyCompensation,
}: ContractRateConverterCardProps) {
  const activeFormula = formula || DEFAULT_RATE_FORMULA;

  const [rateInput, setRateInput] = useState<string>('50');
  const [rateBasis, setRateBasis] = useState<RateBasis>(activeFormula.base_rate_type || 'hourly');
  const [ctcInput, setCtcInput] = useState<string>('');
  const [calcDirection, setCalcDirection] = useState<'rate_to_ctc' | 'ctc_to_rate'>('rate_to_ctc');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [appliedNotice, setAppliedNotice] = useState(false);

  // Rate -> CTC
  const calculatedResult = useMemo(() => {
    const numRate = parseFloat(rateInput) || 0;
    return executeRateFormula(activeFormula, {
      rate: numRate,
      rateBasis: rateBasis,
    });
  }, [activeFormula, rateInput, rateBasis]);

  // CTC -> Rate
  const reverseResult = useMemo(() => {
    const numCTC = parseFloat(ctcInput) || 0;
    return reverseCalculateRateFromCTC(activeFormula, numCTC, rateBasis);
  }, [activeFormula, ctcInput, rateBasis]);

  const handleApply = () => {
    if (calcDirection === 'rate_to_ctc') {
      const finalCTC = calculatedResult.rates.final_ctc;
      // Generate formatted bounds, e.g. min = CTC * 0.95, max = CTC
      const minVal = Math.round(finalCTC * 0.95);
      const maxVal = Math.round(finalCTC);
      onApplyCompensation(minVal.toLocaleString(), maxVal.toLocaleString());
    } else {
      const targetCTC = parseFloat(ctcInput) || 0;
      const minVal = Math.round(targetCTC * 0.95);
      const maxVal = Math.round(targetCTC);
      onApplyCompensation(minVal.toLocaleString(), maxVal.toLocaleString());
    }
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 3000);
  };

  return (
    <div className="rounded-lg border border-[#bfdbfe] bg-[#f0f9ff]/50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dbeafe] pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-[#2563eb] p-1.5 text-white">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[0.88rem] font-bold text-[#1e40af]">Contract Rate &harr; CTC Converter</span>
              <Badge className="border-transparent bg-[#dbeafe] text-[0.65rem] font-semibold text-[#1e40af] hover:bg-[#dbeafe]">
                Auto-Conversion Active
              </Badge>
            </div>
            <p className="text-[0.72rem] text-[#64748b]">
              Formula: {clientName ? `Inherited from ${clientName}` : 'Standard Contract Matrix'} (Margin: {activeFormula.margin_percent}%)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCustomizer((prev) => !prev)}
            className="h-7 gap-1 text-[0.74rem] text-[#2563eb] border-[#bfdbfe] hover:bg-[#eff6ff]"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {showCustomizer ? 'Hide Formula' : 'Customize Formula'}
          </Button>
        </div>
      </div>

      {/* Main Conversion Controls */}
      <div className="mt-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[0.75rem]">
          <span className="font-semibold text-[#475569]">Conversion Mode:</span>
          <button
            type="button"
            onClick={() => setCalcDirection('rate_to_ctc')}
            className={`rounded px-2.5 py-1 text-[0.74rem] font-semibold transition-colors ${
              calcDirection === 'rate_to_ctc'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'bg-white text-[#475569] border border-[#cbd5e1] hover:bg-[#f8fafc]'
            }`}
          >
            Hourly/Monthly Rate &rarr; Annual CTC
          </button>
          <button
            type="button"
            onClick={() => setCalcDirection('ctc_to_rate')}
            className={`rounded px-2.5 py-1 text-[0.74rem] font-semibold transition-colors ${
              calcDirection === 'ctc_to_rate'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'bg-white text-[#475569] border border-[#cbd5e1] hover:bg-[#f8fafc]'
            }`}
          >
            Annual CTC &rarr; Hourly/Monthly Rate
          </button>
        </div>

        {calcDirection === 'rate_to_ctc' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
            <div className="sm:col-span-4">
              <label className="mb-1 block text-[0.74rem] font-semibold text-[#334155]">Contract Rate</label>
              <Input
                type="number"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="e.g. 50"
                className="h-8 text-[0.85rem] font-semibold"
              />
            </div>
            <div className="sm:col-span-3">
              <FormSelect
                label="Billing Unit"
                options={RATE_TYPE_OPTIONS}
                value={rateBasis}
                onChange={(v) => setRateBasis(v as RateBasis)}
                small
              />
            </div>
            <div className="sm:col-span-5 flex items-center justify-between gap-3 rounded-md border border-[#93c5fd] bg-white px-3 py-1.5 shadow-sm">
              <div>
                <div className="text-[0.66rem] font-semibold text-[#64748b] uppercase tracking-wider">Equivalent Annual CTC</div>
                <div className="font-mono text-[1.05rem] font-extrabold text-[#1d4ed8]">
                  ₹ {calculatedResult.rates.final_ctc.toLocaleString()}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                className="h-7 text-[0.72rem] bg-[#2563eb] hover:bg-[#1d4ed8] gap-1"
              >
                {appliedNotice ? <Check className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                {appliedNotice ? 'Applied!' : 'Apply to Comp'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
            <div className="sm:col-span-4">
              <label className="mb-1 block text-[0.74rem] font-semibold text-[#334155]">Target Annual CTC (₹)</label>
              <Input
                type="number"
                value={ctcInput}
                onChange={(e) => setCtcInput(e.target.value)}
                placeholder="e.g. 1200000"
                className="h-8 text-[0.85rem] font-semibold"
              />
            </div>
            <div className="sm:col-span-3">
              <FormSelect
                label="Desired Rate Basis"
                options={RATE_TYPE_OPTIONS}
                value={rateBasis}
                onChange={(v) => setRateBasis(v as RateBasis)}
                small
              />
            </div>
            <div className="sm:col-span-5 flex items-center justify-between gap-3 rounded-md border border-[#93c5fd] bg-white px-3 py-1.5 shadow-sm">
              <div>
                <div className="text-[0.66rem] font-semibold text-[#64748b] uppercase tracking-wider">Equivalent Rate</div>
                <div className="font-mono text-[1.05rem] font-extrabold text-[#1d4ed8]">
                  ₹ {reverseResult.rate.toLocaleString()} {rateBasis === 'hourly' ? '/ hr' : rateBasis === 'weekly' ? '/ wk' : '/ mo'}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                disabled={!ctcInput}
                className="h-7 text-[0.72rem] bg-[#2563eb] hover:bg-[#1d4ed8] gap-1"
              >
                {appliedNotice ? <Check className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                {appliedNotice ? 'Applied!' : 'Apply to Comp'}
              </Button>
            </div>
          </div>
        )}

        {/* Breakdown bar */}
        <div className="grid grid-cols-3 gap-2 rounded bg-white p-2 text-center text-[0.72rem] border border-[#e2e8f0]">
          <div>
            <span className="text-[#64748b]">Monthly Base: </span>
            <span className="font-mono font-semibold text-[#0f172a]">
              ₹ {calculatedResult.rates.monthly.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[#64748b]">Annual Base: </span>
            <span className="font-mono font-semibold text-[#0f172a]">
              ₹ {calculatedResult.rates.annual_base.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[#64748b]">Markup Margin ({activeFormula.margin_percent}%): </span>
            <span className="font-mono font-semibold text-[#16a34a]">
              +₹ {calculatedResult.rates.margin_amount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Customizer */}
      {showCustomizer && (
        <div className="mt-4 border-t border-[#dbeafe] pt-3">
          <FormulaCreator value={activeFormula} onChange={onFormulaChange} />
        </div>
      )}
    </div>
  );
}
