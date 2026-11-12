'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchInputProps {
  value: string;
  onDebouncedChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

/** Debounced search box; calls onDebouncedChange only after typing settles for debounceMs. */
export function SearchInput({ value, onDebouncedChange, placeholder = 'Search...', debounceMs = 400, className }: SearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const debouncedValue = useDebounce(inputValue, debounceMs);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    onDebouncedChange(debouncedValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  // Re-sync when `value` changes from OUTSIDE this component (e.g. a parent's "Clear
  // Filters" resetting it to ''), since the debounced echo above only ever pushes this
  // component's own edits out — it never pulls an external reset back in. Only fires when
  // the prop itself changes, so it never clobbers in-progress typing before the debounce
  // has caught up.
  useEffect(() => {
    setInputValue(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={`search-box ${className ?? 'w-[280px]'}`}>
      <i className="fa-solid fa-magnifying-glass search-icon"></i>
      <input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      {inputValue && (
        <button type="button" onClick={() => setInputValue('')} aria-label="Clear search" className="search-clear">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
