'use client';

import { useState, useMemo } from 'react';
import { Plus, Trash2, Calculator, Play, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FormSelect } from '@/components/ui/FormSelect';
import {
  RateFormulaConfig,
  FormulaStep,
  DEFAULT_RATE_FORMULA,
  executeRateFormula,
  reverseCalculateRateFromCTC,
  RateBasis,
} from '@/lib/rateConverter/formulaEngine';

interface FormulaCreatorProps {
  value: RateFormulaConfig;
  onChange: (formula: RateFormulaConfig) => void;
  readOnly?: boolean;
}

const RATE_TYPE_OPTIONS = [
  { value: 'hourly', label: 'Hourly Rate' },
  { value: 'weekly', label: 'Weekly Rate' },
  { value: 'monthly', label: 'Monthly Rate' },
];

export function FormulaCreator({ value, onChange, readOnly = false }: FormulaCreatorProps) {
  const formula = value || DEFAULT_RATE_FORMULA;

  const [testRate, setTestRate] = useState<string>('50');
  const [testBasis, setTestBasis] = useState<RateBasis>(formula.base_rate_type || 'hourly');
  const [testCTC, setTestCTC] = useState<string>('137280');
  const [testMode, setTestMode] = useState<'rate_to_ctc' | 'ctc_to_rate'>('rate_to_ctc');

  const [newVarName, setNewVarName] = useState('');
  const [newVarVal, setNewVarVal] = useState('');

  const [newStepVar, setNewStepVar] = useState('');
  const [newStepExpr, setNewStepExpr] = useState('');

  // Update helpers
  const updateField = <K extends keyof RateFormulaConfig>(key: K, val: RateFormulaConfig[K]) => {
    onChange({ ...formula, [key]: val });
  };

  const handleAddVariable = () => {
    if (!newVarName.trim()) return;
    const cleanName = newVarName.trim().replace(/[^a-zA-Z0-9_]/g, '');
    const numVal = parseFloat(newVarVal) || 0;
    const updatedVars = { ...formula.custom_variables, [cleanName]: numVal };
    updateField('custom_variables', updatedVars);
    setNewVarName('');
    setNewVarVal('');
  };

  const handleRemoveVariable = (varName: string) => {
    const updatedVars = { ...formula.custom_variables };
    delete updatedVars[varName];
    updateField('custom_variables', updatedVars);
  };

  const handleAddStep = () => {
    if (!newStepVar.trim() || !newStepExpr.trim()) return;
    const cleanVar = newStepVar.trim().replace(/[^a-zA-Z0-9_]/g, '');
    const newStep: FormulaStep = {
      id: `step_${Date.now()}`,
      variable: cleanVar,
      expression: newStepExpr.trim(),
    };
    updateField('steps', [...(formula.steps || []), newStep]);
    setNewStepVar('');
    setNewStepExpr('');
  };

  const handleRemoveStep = (stepId: string) => {
    updateField('steps', (formula.steps || []).filter((s) => s.id !== stepId));
  };

  const handleUpdateStep = (stepId: string, patch: Partial<FormulaStep>) => {
    updateField(
      'steps',
      (formula.steps || []).map((s) => (s.id === stepId ? { ...s, ...patch } : s))
    );
  };

  const appendToExpr = (char: string) => {
    setNewStepExpr((prev) => (prev ? `${prev} ${char} ` : `${char} `));
  };

  // Available variable chips for quick insertion
  const availableVariables = useMemo(() => {
    const builtIn = ['rate', 'annual_base', 'hours_per_day', 'working_days', 'margin_percent'];
    const custom = Object.keys(formula.custom_variables || {});
    const previousStepVars = (formula.steps || []).map((s) => s.variable);
    return Array.from(new Set([...builtIn, ...custom, ...previousStepVars]));
  }, [formula]);

  // Live evaluation
  const evaluationResult = useMemo(() => {
    const numericRate = parseFloat(testRate) || 0;
    return executeRateFormula(formula, {
      rate: numericRate,
      rateBasis: testBasis,
    });
  }, [formula, testRate, testBasis]);

  const reverseResult = useMemo(() => {
    const numericCTC = parseFloat(testCTC) || 0;
    return reverseCalculateRateFromCTC(formula, numericCTC, testBasis);
  }, [formula, testCTC, testBasis]);

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f5f9] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-[#2563eb]" />
            <h4 className="text-[0.92rem] font-bold text-[#0f172a]">Rate to CTC Formula Configurator</h4>
          </div>
          <p className="mt-0.5 text-[0.74rem] text-[#64748b]">
            Configure standard rates, variables, and formulas for automatic contract rate &harr; CTC conversion.
          </p>
        </div>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(DEFAULT_RATE_FORMULA)}
            className="gap-1.5 text-[0.74rem]"
          >
            <RefreshCw className="h-3 w-3" /> Reset to Default Formula
          </Button>
        )}
      </div>

      {/* Basic Parameters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <FormSelect
            label="Default Rate Basis"
            options={RATE_TYPE_OPTIONS}
            value={formula.base_rate_type || 'hourly'}
            onChange={(v) => updateField('base_rate_type', v as RateBasis)}
            disabled={readOnly}
            small
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.74rem] font-semibold text-[#475569]">Working Hours / Day</label>
          <Input
            type="number"
            min={1}
            max={24}
            value={formula.working_hours_per_day}
            onChange={(e) => updateField('working_hours_per_day', parseFloat(e.target.value) || 8)}
            disabled={readOnly}
            className="h-8 text-[0.8rem]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.74rem] font-semibold text-[#475569]">Working Days / Month</label>
          <Input
            type="number"
            min={1}
            max={31}
            value={formula.working_days_per_month}
            onChange={(e) => updateField('working_days_per_month', parseFloat(e.target.value) || 22)}
            disabled={readOnly}
            className="h-8 text-[0.8rem]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[0.74rem] font-semibold text-[#475569]">Default Margin (%)</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={formula.margin_percent}
            onChange={(e) => updateField('margin_percent', parseFloat(e.target.value) || 0)}
            disabled={readOnly}
            className="h-8 text-[0.8rem]"
          />
        </div>
      </div>

      {/* Custom Variables Section */}
      <div className="rounded-md border border-[#f1f5f9] bg-[#f8fafc] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.78rem] font-bold text-[#334155]">Initial Variables (e.g. a = 100, b = 20, z = 10)</span>
          <span className="text-[0.7rem] text-[#64748b]">Constants available across all steps</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(formula.custom_variables || {}).map(([name, val]) => (
            <div
              key={name}
              className="flex items-center gap-1.5 rounded border border-[#cbd5e1] bg-white px-2.5 py-1 text-[0.78rem]"
            >
              <span className="font-semibold text-[#2563eb]">{name}</span>
              <span className="text-[#64748b]">=</span>
              <span className="font-mono text-[#0f172a]">{val}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveVariable(name)}
                  className="ml-1 text-[#94a3b8] hover:text-[#dc2626]"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {!readOnly && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Input
              placeholder="Variable (e.g. z)"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              className="h-7 w-28 text-[0.76rem]"
            />
            <span className="text-[#64748b]">=</span>
            <Input
              type="number"
              placeholder="Value (e.g. 10)"
              value={newVarVal}
              onChange={(e) => setNewVarVal(e.target.value)}
              className="h-7 w-28 text-[0.76rem]"
            />
            <Button type="button" size="sm" variant="outline" onClick={handleAddVariable} className="h-7 gap-1 text-[0.74rem]">
              <Plus className="h-3 w-3" /> Add Variable
            </Button>
          </div>
        )}
      </div>

      {/* Sequential Formula Steps */}
      <div className="rounded-md border border-[#e2e8f0] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.78rem] font-bold text-[#334155]">Formula Steps (Sequential Execution)</span>
          <span className="text-[0.7rem] text-[#64748b]">Supports +, -, *, /, divide, %</span>
        </div>

        <div className="flex flex-col gap-2">
          {(formula.steps || []).map((step, idx) => (
            <div
              key={step.id}
              className="flex flex-wrap items-center gap-2 rounded border border-[#e2e8f0] bg-[#f8fafc] p-2 text-[0.8rem]"
            >
              <Badge className="bg-[#e2e8f0] text-[0.68rem] font-bold text-[#475569] hover:bg-[#e2e8f0]">
                Step {idx + 1}
              </Badge>
              <Input
                value={step.variable}
                onChange={(e) => handleUpdateStep(step.id, { variable: e.target.value })}
                disabled={readOnly}
                className="h-7 w-28 font-semibold text-[#2563eb]"
              />
              <span className="font-bold text-[#64748b]">=</span>
              <Input
                value={step.expression}
                onChange={(e) => handleUpdateStep(step.id, { expression: e.target.value })}
                disabled={readOnly}
                className="h-7 flex-1 min-w-[180px] font-mono text-[0.78rem]"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveStep(step.id)}
                  className="p-1 text-[#94a3b8] hover:text-[#dc2626]"
                  title="Delete step"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add Step Creator */}
        {!readOnly && (
          <div className="mt-3 flex flex-col gap-2 rounded border border-dashed border-[#cbd5e1] p-2.5">
            <span className="text-[0.72rem] font-semibold text-[#475569]">Add New Formula Step:</span>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Variable (e.g. c)"
                value={newStepVar}
                onChange={(e) => setNewStepVar(e.target.value)}
                className="h-7 w-28 text-[0.76rem]"
              />
              <span className="text-[#64748b]">=</span>
              <Input
                placeholder="Expression (e.g. a + b, c + z, x * 30%)"
                value={newStepExpr}
                onChange={(e) => setNewStepExpr(e.target.value)}
                className="h-7 flex-1 min-w-[160px] text-[0.76rem]"
              />
              <Button type="button" size="sm" onClick={handleAddStep} className="h-7 gap-1 text-[0.74rem]">
                <Plus className="h-3 w-3" /> Add Step
              </Button>
            </div>

            {/* Quick Helper Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[0.68rem] text-[#94a3b8]">Quick operators:</span>
              {['+', '-', '*', '/', '%'].map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => appendToExpr(op)}
                  className="rounded border border-[#e2e8f0] bg-white px-1.5 py-0.5 font-mono text-[0.68rem] font-bold text-[#2563eb] hover:bg-[#eff6ff]"
                >
                  {op}
                </button>
              ))}
              <span className="ml-2 text-[0.68rem] text-[#94a3b8]">Variables:</span>
              {availableVariables.slice(0, 8).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => appendToExpr(v)}
                  className="rounded border border-[#e2e8f0] bg-white px-1.5 py-0.5 text-[0.68rem] text-[#475569] hover:bg-[#f1f5f9]"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Live Interactive Tester */}
      <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff]/40 p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#dbeafe] pb-2">
          <div className="flex items-center gap-1.5">
            <Play className="h-3.5 w-3.5 text-[#2563eb]" />
            <span className="text-[0.82rem] font-bold text-[#1e40af]">Live Auto-Conversion Tester</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTestMode('rate_to_ctc')}
              className={`rounded px-2 py-0.5 text-[0.72rem] font-semibold transition-colors ${
                testMode === 'rate_to_ctc'
                  ? 'bg-[#2563eb] text-white'
                  : 'bg-white text-[#475569] border border-[#cbd5e1]'
              }`}
            >
              Rate &rarr; CTC
            </button>
            <button
              type="button"
              onClick={() => setTestMode('ctc_to_rate')}
              className={`rounded px-2 py-0.5 text-[0.72rem] font-semibold transition-colors ${
                testMode === 'ctc_to_rate'
                  ? 'bg-[#2563eb] text-white'
                  : 'bg-white text-[#475569] border border-[#cbd5e1]'
              }`}
            >
              CTC &rarr; Rate
            </button>
          </div>
        </div>

        {testMode === 'rate_to_ctc' ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-40">
                <label className="mb-0.5 block text-[0.72rem] font-semibold text-[#475569]">Input Rate</label>
                <Input
                  type="number"
                  value={testRate}
                  onChange={(e) => setTestRate(e.target.value)}
                  className="h-8 text-[0.82rem]"
                />
              </div>
              <div className="w-40">
                <FormSelect
                  label="Basis"
                  options={RATE_TYPE_OPTIONS}
                  value={testBasis}
                  onChange={(v) => setTestBasis(v as RateBasis)}
                  small
                />
              </div>
            </div>

            {/* Calculated Results Card */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded border border-[#bfdbfe] bg-white p-2 text-center">
                <div className="text-[0.68rem] font-semibold text-[#64748b]">Base Monthly</div>
                <div className="font-mono text-[0.85rem] font-bold text-[#0f172a]">
                  {evaluationResult.rates.monthly.toLocaleString()}
                </div>
              </div>
              <div className="rounded border border-[#bfdbfe] bg-white p-2 text-center">
                <div className="text-[0.68rem] font-semibold text-[#64748b]">Annual Base</div>
                <div className="font-mono text-[0.85rem] font-bold text-[#0f172a]">
                  {evaluationResult.rates.annual_base.toLocaleString()}
                </div>
              </div>
              <div className="rounded border border-[#bfdbfe] bg-white p-2 text-center">
                <div className="text-[0.68rem] font-semibold text-[#64748b]">Margin ({formula.margin_percent}%)</div>
                <div className="font-mono text-[0.85rem] font-bold text-[#16a34a]">
                  +{evaluationResult.rates.margin_amount.toLocaleString()}
                </div>
              </div>
              <div className="rounded border border-[#2563eb] bg-[#2563eb] p-2 text-center text-white">
                <div className="text-[0.68rem] font-semibold text-blue-100">Calculated CTC</div>
                <div className="font-mono text-[0.95rem] font-extrabold">
                  {evaluationResult.rates.final_ctc.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Intermediate Steps Output */}
            {evaluationResult.stepDetails.length > 0 && (
              <div className="mt-1 rounded border border-[#dbeafe] bg-white p-2">
                <span className="text-[0.7rem] font-bold text-[#475569]">Step Execution Breakdown:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {evaluationResult.stepDetails.map((s) => (
                    <span key={s.id} className="rounded bg-[#f8fafc] px-2 py-0.5 text-[0.72rem] text-[#334155] border border-[#e2e8f0]">
                      <span className="font-semibold text-[#2563eb]">{s.variable}</span>: {s.expression} = <span className="font-mono font-bold">{s.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-52">
                <label className="mb-0.5 block text-[0.72rem] font-semibold text-[#475569]">Target Annual CTC</label>
                <Input
                  type="number"
                  value={testCTC}
                  onChange={(e) => setTestCTC(e.target.value)}
                  className="h-8 text-[0.82rem]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded border border-[#bfdbfe] bg-white p-2 text-center">
                <div className="text-[0.68rem] font-semibold text-[#64748b]">Equivalent Hourly</div>
                <div className="font-mono text-[0.85rem] font-bold text-[#2563eb]">
                  {reverseResult.hourly.toLocaleString()} / hr
                </div>
              </div>
              <div className="rounded border border-[#bfdbfe] bg-white p-2 text-center">
                <div className="text-[0.68rem] font-semibold text-[#64748b]">Equivalent Weekly</div>
                <div className="font-mono text-[0.85rem] font-bold text-[#0f172a]">
                  {reverseResult.weekly.toLocaleString()} / wk
                </div>
              </div>
              <div className="rounded border border-[#bfdbfe] bg-white p-2 text-center">
                <div className="text-[0.68rem] font-semibold text-[#64748b]">Equivalent Monthly</div>
                <div className="font-mono text-[0.85rem] font-bold text-[#0f172a]">
                  {reverseResult.monthly.toLocaleString()} / mo
                </div>
              </div>
              <div className="rounded border border-[#bfdbfe] bg-white p-2 text-center">
                <div className="text-[0.68rem] font-semibold text-[#64748b]">Base (Excl. Margin)</div>
                <div className="font-mono text-[0.85rem] font-bold text-[#475569]">
                  {reverseResult.baseAnnual.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
