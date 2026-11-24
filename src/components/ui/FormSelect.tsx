'use client';

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './select';

// Radix forbids a real `<SelectItem value="">` (it throws), so an opt-in "clearable" placeholder
// row is given this sentinel internally and translated back to '' at both edges — the caller's
// `value`/`onChange` never see it. Unlikely enough to collide with a real option value.
const EMPTY_OPTION_VALUE = '__form_select_empty__';

interface FormSelectProps {
  label?: string;
  required?: boolean;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  small?: boolean;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  /**
   * Adds a real, selectable "placeholder" row at the top of the list (muted text, using
   * `placeholder`/"None") for a genuinely OPTIONAL field — selecting it clears the field back to
   * `''`. Without this, Radix shows a blank trigger (not an error) whenever `value` doesn't match
   * any option — which is exactly how a saved-but-unset optional field (`''`/`null` from the API)
   * used to render with no way to tell "unset" from "still loading" and no way to re-clear a
   * value once something else was picked. Omit for a required field, where every value must
   * already match a real option.
   */
  allowClear?: boolean;
  /** Label of the clear row; defaults to `placeholder` so existing callers are unaffected. */
  clearLabel?: string;
  /**
   * Radix moves focus back to the trigger when the dropdown closes. A caller that needs the caret
   * somewhere else afterwards (e.g. SkillsSelector handing focus to its input after a role pick)
   * can `preventDefault()` and move focus itself. Omitted everywhere else, so the default
   * behaviour of every other select is untouched.
   */
  onCloseAutoFocus?: (event: Event) => void;
  className?: string;
}

export function FormSelect({ label, required, options, value, onChange, small, placeholder, disabled, error, allowClear, clearLabel, onCloseAutoFocus, className }: FormSelectProps) {
  const selectValue = allowClear && value === '' ? EMPTY_OPTION_VALUE : value;
  const handleValueChange = (next: string) => onChange(next === EMPTY_OPTION_VALUE ? '' : next);

  return (
    <div className={className}>
      {label && (
        <label className={`mb-1 block font-semibold text-[#475569] ${small ? 'text-[0.78rem]' : 'text-[0.8rem]'}`}>
          {label}{required && <span className="text-[#dc2626]"> *</span>}
        </label>
      )}
      <Select value={selectValue} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger className={(small ? 'h-auto w-full rounded-md border-[#e2e8f0] px-2.5 py-2 text-[0.83rem] shadow-none' : 'h-auto w-full rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none') + (error ? ' border-[#fca5a5]' : '')}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent onCloseAutoFocus={onCloseAutoFocus}>
          {allowClear && (
            <SelectItem value={EMPTY_OPTION_VALUE} className="text-[#94a3b8]">
              {clearLabel || placeholder || 'None'}
            </SelectItem>
          )}
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{error}</span>}
    </div>
  );
}
