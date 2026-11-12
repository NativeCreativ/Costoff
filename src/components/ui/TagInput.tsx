'use client';

import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Badge } from './badge';

interface TagInputProps {
  label?: string;
  required?: boolean;
  placeholder?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  error?: string;
}

/** Tag/badge input; Enter or comma commits a tag, duplicates (case-insensitive) are ignored. */
export function TagInput({ label, required, placeholder, value, onChange, error }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    const exists = value.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (!exists) onChange([...value, tag]);
    setInputValue('');
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  return (
    <div>
      {label && (
        <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">
          {label}{required && <span className="text-[#dc2626]"> *</span>}
        </label>
      )}
      <div className="flex w-full flex-wrap items-center gap-1.5 rounded-md border border-[#e2e8f0] px-2.5 py-2">
        {value.map((tag, index) => (
          <Badge
            key={`${tag}-${index}`}
            className="gap-1 rounded border-transparent bg-[#eff6ff] px-2 py-0.5 text-[0.75rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              aria-label={`Remove ${tag}`}
              className="ml-0.5 inline-flex items-center justify-center rounded-full hover:text-[#dc2626]"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(inputValue)}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="min-w-[120px] flex-1 border-none bg-transparent p-0 text-[0.85rem] outline-none placeholder:text-[#94a3b8]"
        />
      </div>
      {error && <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{error}</span>}
    </div>
  );
}
