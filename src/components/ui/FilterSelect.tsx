'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel?: string;
  className?: string;
  /** Optional visible label rendered above the select. Omitted callers are unaffected. */
  label?: string;
}

const ALL_VALUE = '__all__';

/** Generic dropdown filter. An empty string value always means "no filter applied". */
export function FilterSelect({ value, onChange, options, allLabel = 'All', className, label }: FilterSelectProps) {
  const known = new Set(options.map((opt) => opt.value));
  const extra = value && !known.has(value) ? [{ value, label: value }] : [];
  const items = [...extra, ...options];

  const control = (
    <Select value={value || ALL_VALUE} onValueChange={(next) => onChange(next === ALL_VALUE ? '' : next)}>
      <SelectTrigger
        aria-label={label || allLabel}
        className={cn(
          'h-10 w-auto min-w-[9.75rem] justify-between gap-2.5 rounded-lg border-[#cbd5e1] bg-white px-3.5 text-[0.83rem] font-semibold text-[#334155] shadow-sm',
          'hover:border-[#93c5fd] hover:bg-[#f8fafc]',
          'focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20',
          'data-[state=open]:border-[#2563eb] data-[state=open]:bg-[#eff6ff]',
          '[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-[#475569] [&_svg]:opacity-100',
          value && 'border-[#93c5fd] bg-[#eff6ff] text-[#1d4ed8]',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {items.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!label) return control;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.78rem] font-semibold text-[#475569]">{label}</span>
      {control}
    </div>
  );
}
