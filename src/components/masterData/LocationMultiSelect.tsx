'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNamedMasterQuery } from '@/queries/masterData/useMasterData';

interface LocationMultiSelectProps {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
}

function same(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Multi-select of the Locations master. Saved values that are no longer in the
 * master stay visible so an edit does not silently drop them.
 */
export function LocationMultiSelect({ label = 'Locations', value, onChange }: LocationMultiSelectProps) {
  const query = useNamedMasterQuery('locations');
  const [text, setText] = useState('');
  const options = query.data ?? [];
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    return options
      .filter((option) => !value.some((selected) => same(selected, option.name)))
      .filter((option) => !q || option.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [options, text, value]);

  const add = (name: string) => {
    if (value.some((selected) => same(selected, name))) return;
    onChange([...value, name]);
    setText('');
  };

  const commitTyped = () => {
    const typed = text.trim();
    if (!typed) return;
    const match = options.find((option) => same(option.name, typed));
    if (match) add(match.name);
  };

  return (
    <div>
      <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">{label}</label>
      <div className="rounded-md border border-[#e2e8f0] bg-white p-2">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((item) => {
            const known = options.some((option) => same(option.name, item));
            return (
              <span key={item} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.75rem] ${known ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'bg-[#fef3c7] text-[#92400e]'}`}>
                {item}
                <button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(value.filter((v) => v !== item))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {value.length === 0 && <span className="text-[0.75rem] text-[#94a3b8]">No locations selected</span>}
        </div>
        <Input
          value={text}
          placeholder={query.isLoading ? 'Loading locations…' : 'Type to search locations'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitTyped();
            }
          }}
          className="h-8"
        />
        {matches.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {matches.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => add(option.name)}
                className="rounded-full border border-[#dbeafe] bg-[#f8fafc] px-2 py-0.5 text-[0.72rem] text-[#334155] hover:bg-[#eff6ff]"
              >
                {option.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
