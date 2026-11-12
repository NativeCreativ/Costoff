'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from './popover';
import { Badge } from './badge';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

export interface EntityOption {
  id: string;
  label: string;
  sublabel?: string;
  tag?: string;
  /**
   * Renders the option greyed out and ignores clicks on it — for records that must stay VISIBLE
   * but must not be picked (e.g. a Demand's current INACTIVE company, which has to remain
   * readable/unchangeable rather than disappear from the list).
   *
   * Optional and additive: omitting it keeps every existing caller behaving exactly as before.
   * Enforcement still belongs on the server; this is presentation only.
   */
  disabled?: boolean;
}

interface EntitySelectBaseProps {
  options: EntityOption[];
  label?: string;
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  error?: string;
  disabled?: boolean;
  isLoading?: boolean;
  emptyLabel?: string;
  /** Label for the currently-selected single value, kept visible even when the value is not
   *  in `options` (e.g. it was selected under a narrower search, or buried below the limit). */
  selectedLabel?: string;
  /** When provided, typing debounces into this callback (server-side search) instead of
   *  filtering `options` client-side — the parent is responsible for re-fetching `options`. */
  onSearchChange?: (term: string) => void;
  debounceMs?: number;
}

interface EntitySelectSingleProps extends EntitySelectBaseProps {
  mode: 'single';
  value: string;
  onChange: (value: string) => void;
}

interface EntitySelectMultipleProps extends EntitySelectBaseProps {
  mode: 'multiple';
  value: string[];
  onChange: (value: string[]) => void;
}

type EntitySelectProps = EntitySelectSingleProps | EntitySelectMultipleProps;

/** Generic searchable picker; mode="single" returns a string id, mode="multiple" returns string[].
 *  Without onSearchChange, filters `options` client-side (the original UserSelect behavior).
 *  With onSearchChange, the search box debounces and defers filtering to the parent (DB search). */
export function EntitySelect(props: EntitySelectProps) {
  const { options, label, required, placeholder, searchPlaceholder, error, disabled, isLoading, emptyLabel, onSearchChange, selectedLabel, debounceMs = 400 } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, debounceMs);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (!onSearchChange) return;
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    onSearchChange(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const selectedIds = props.mode === 'multiple' ? props.value : props.value ? [props.value] : [];

  const filteredOptions = useMemo(() => {
    if (onSearchChange) return options;
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.sublabel?.toLowerCase().includes(term) ||
        opt.tag?.toLowerCase().includes(term)
    );
  }, [options, search, onSearchChange]);

  const selectedOptions = useMemo(
    () => selectedIds.map((id) => options.find((opt) => opt.id === id)).filter((opt): opt is EntityOption => !!opt),
    [selectedIds, options]
  );

  const toggleOption = (id: string) => {
    if (props.mode === 'single') {
      props.onChange(id);
      setOpen(false);
      return;
    }
    const exists = props.value.includes(id);
    props.onChange(exists ? props.value.filter((v) => v !== id) : [...props.value, id]);
  };

  const removeOption = (id: string) => {
    if (props.mode === 'single') {
      props.onChange('');
      return;
    }
    props.onChange(props.value.filter((v) => v !== id));
  };

  const clearAll = () => {
    props.mode === 'single' ? props.onChange('') : props.onChange([]);
  };

  /**
   * A `disabled` selection is one kept only for reference — currently a Demand's own INACTIVE
   * company, which stays in the list so the Demand keeps pointing at the right record. It can
   * never be re-picked, so offering to clear it would be a one-way trip: the record disappears
   * from the list entirely and the user is left unable to restore it, forced to either move the
   * record to a different value or abandon the edit. So the clear affordance is withheld.
   */
  const canClearSelection = selectedOptions.length > 0 && selectedOptions.every((opt) => !opt.disabled);

  return (
    <div>
      {label && (
        <label className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">
          {label}
          {required && <span className="text-[#dc2626]"> *</span>}
        </label>
      )}

      <Popover open={disabled ? false : open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'flex min-h-9 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-left text-[0.85rem] shadow-sm outline-none transition-colors',
              'border-[#e2e8f0] focus:border-[#3b82f6] focus:ring-[3px] focus:ring-[rgba(59,130,246,0.15)]',
              disabled && 'cursor-not-allowed bg-[#f8fafc] opacity-60',
              error && 'border-[#fca5a5]'
            )}
          >
            {selectedOptions.length === 0 && !selectedLabel ? (
          <span className="text-[#94a3b8]">{placeholder || 'Select…'}</span>
        ) : props.mode === 'single' ? (
          <span className="truncate text-[#0f172a]">
            {selectedOptions[0]?.label || selectedLabel}
            {/* Label a reference-only selection in the trigger itself, not just inside the
                open list — otherwise the field reads as a normal, choosable company while
                the one option is refused. `disabled` is what marks it as reference-only,
                so every other caller (which never sets it) renders exactly as before. */}
            {selectedOptions[0]?.disabled && selectedOptions[0].tag && (
              <span className="ml-1 font-normal text-[#94a3b8]">({selectedOptions[0].tag})</span>
            )}
          </span>
        ) : (
              <span className="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
                {selectedOptions.map((opt) => (
                  <Badge
                    key={opt.id}
                    className="gap-1 rounded border-transparent bg-[#eff6ff] px-2 py-0.5 text-[0.72rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]"
                  >
                    {opt.label}
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOption(opt.id);
                      }}
                      className="ml-0.5 inline-flex items-center justify-center rounded-full hover:text-[#dc2626]"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ))}
              </span>
            )}
            <span className="flex shrink-0 items-center gap-1">
              {canClearSelection && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll();
                  }}
                  className="rounded-full p-0.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569]"
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronDown className="h-4 w-4 text-[#94a3b8]" />
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder || 'Search…'}
              className="w-full border-none bg-transparent p-0 text-[0.83rem] outline-none placeholder:text-[#94a3b8]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="shrink-0 rounded-full p-0.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div
            className="max-h-64 overflow-y-auto overscroll-contain p-1"
            onWheel={(e) => e.stopPropagation()}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[0.8rem] text-[#94a3b8]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-[0.8rem] text-[#94a3b8]">{emptyLabel || 'No results found'}</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedIds.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    // A disabled option stays readable in the list but cannot be picked. It is
                    // still rendered as the current value when it is already selected — clicking
                    // it is simply a no-op, so the Demand's company can never be cleared or
                    // swapped to an ineligible record from here.
                    onClick={() => { if (!opt.disabled) toggleOption(opt.id); }}
                    disabled={opt.disabled}
                    title={opt.disabled ? `${opt.label} cannot be selected` : undefined}
                    aria-disabled={opt.disabled || undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[0.83rem] outline-none',
                      opt.disabled
                        ? 'cursor-not-allowed bg-transparent opacity-60'
                        : 'hover:bg-[#eff6ff]',
                      isSelected && 'bg-[#eff6ff]'
                    )}
                  >
                    {props.mode === 'multiple' && (
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          isSelected ? 'border-[#2563eb] bg-[#2563eb] text-white' : 'border-[#cbd5e1] bg-white'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium text-[#0f172a]">
                        {opt.label}
                        {opt.tag && <span className="ml-1 font-normal text-[#94a3b8]">({opt.tag})</span>}
                      </span>
                      {opt.sublabel && <span className="truncate text-[0.72rem] text-[#94a3b8]">{opt.sublabel}</span>}
                    </span>
                    {props.mode === 'single' && isSelected && <Check className="h-4 w-4 shrink-0 text-[#2563eb]" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {error && <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{error}</span>}
    </div>
  );
}
