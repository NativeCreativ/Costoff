'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormSelect } from './FormSelect';
import { Badge } from './badge';
import { useToast } from './Toast';
import { useSkillsLibraryQuery } from '@/queries/settings/useSkillsLibraryQueries';
import { useSkillGroupsQuery } from '@/queries/settings/useSkillGroups';
import { SKILL_MAX_LENGTH } from '@/lib/skills';

interface SkillsSelectorProps {
  label?: string;
  categoryLabel?: string;
  required?: boolean;
  value: string[];
  onChange: (skills: string[]) => void;
  /** Schema-level validation message (e.g. from zodResolver), shown under the box. */
  error?: string;
  /** Pass both to persist the role category; omit both (Candidate) and it stays local UI state. */
  categoryId?: string;
  onCategoryChange?: (categoryId: string) => void;
  /** Placeholder on the skill-group dropdown. Demand calls this a skill group. */
  categoryPlaceholder?: string;
  /**
   * Demand Type → Skill Groups: when non-empty, the dropdown offers only these groups (plus the
   * one already picked) and a "Show all" link. Empty/undefined = every group, as before.
   */
  suggestedCategoryIds?: string[];
  /** Shown next to "Show all" so the user knows why the list is short (e.g. the type's name). */
  suggestedReason?: string;
  /** When 'side-by-side', places Skill Group and Selected Skills next to each other. */
  layout?: 'stacked' | 'side-by-side';
}

function sameSkill(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** True for devices with a real pointer (mouse/trackpad), where moving the caret into the box
 *  after a role pick is helpful. Skipped on touch so a software keyboard isn't popped open. */
function isPointerDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: fine)').matches;
}

/**
 * The one skills field, used by Demand "Required Skills" and Candidate "Key Skills".
 *
 * Backed by the admin-managed Skills library (GET /api/skills-library), but it is a plain
 * `string[]` in / `string[]` out. The category is saved only where the caller passes
 * `categoryId`/`onCategoryChange` (Demand); otherwise it stays local state, as Candidate needs.
 *
 * Deliberately simple: ONE bordered box that is both the chip list and the text input. The only
 * ways to add a skill are picking a role category, or typing a name and pressing Enter. There is
 * no suggestion dropdown — a live suggestion list sat directly under the caret and competed with
 * the thing the user was actually trying to type, so it is gone.
 *
 * Only `value` is real state. Whether the library loaded is derived, and an Edit form preloaded
 * with saved skills (including ones no longer in the library) renders correctly because nothing
 * is cross-checked against the library on the way in.
 */
export function SkillsSelector({ label, categoryLabel, required, value, onChange, error, categoryId, onCategoryChange, categoryPlaceholder, suggestedCategoryIds, suggestedReason, layout = 'stacked' }: SkillsSelectorProps) {
  const libraryQuery = useSkillsLibraryQuery();
  const toast = useToast();
  const listId = useId();

  const isCategoryControlled = onCategoryChange !== undefined;
  const [localCategoryId, setLocalCategoryId] = useState('');
  const [text, setText] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => libraryQuery.data ?? [], [libraryQuery.data]);
  // The category is controlled only where the parent persists it (Demand); Candidate keeps it local.
  const selectedCategoryId = isCategoryControlled ? (categoryId ?? '') : localCategoryId;
  const selectedCategory = useMemo(() => categories.find((c) => c.id === selectedCategoryId) ?? null, [categories, selectedCategoryId]);
  // Review of 18 Nov 2026, item 1: Skill Group -> Skill Category -> Skills. When Skill Groups
  // exist, a Skill Group picker narrows the category list. Only the category is saved, so the
  // group is local UI state, starting from the saved category's group.
  const skillGroupsQuery = useSkillGroupsQuery();
  const skillGroups = useMemo(() => skillGroupsQuery.data ?? [], [skillGroupsQuery.data]);
  const hasGroups = skillGroups.length > 0;
  const [pickedGroupId, setPickedGroupId] = useState<string | null>(null);
  const selectedGroupId = pickedGroupId ?? selectedCategory?.group_id ?? '';
  const isNarrowed = !showAllCategories && !!suggestedCategoryIds && suggestedCategoryIds.length > 0;
  const categoryOptions = useMemo(
    () =>
      (isNarrowed ? categories.filter((c) => suggestedCategoryIds!.includes(c.id) || c.id === selectedCategoryId) : categories)
        .filter((c) => !hasGroups || !selectedGroupId || c.group_id === selectedGroupId || c.id === selectedCategoryId)
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, isNarrowed, suggestedCategoryIds, selectedCategoryId, hasGroups, selectedGroupId]
  );
  const groupPicker = hasGroups ? (
    <div className="mb-2">
      <label htmlFor={`${listId}-group`} className="mb-1 block text-[0.8rem] font-semibold text-[#475569]">Skill Group</label>
      <FormSelect
        small
        placeholder="All skill groups"
        allowClear
        clearLabel="All skill groups"
        options={skillGroups.map((g) => ({ value: g.id, label: g.name }))}
        value={selectedGroupId}
        onChange={(id) => setPickedGroupId(id || '')}
      />
    </div>
  ) : null;
  const effectiveCategoryLabel = hasGroups ? 'Skill Category' : categoryLabel || label || 'Skill Group';

  useEffect(() => {
    if (!libraryQuery.isError) return;
    toast.error("Couldn't load the skills library", 'You can still type skills manually.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryQuery.isError]);

  /** Merge names into the selection, deduping case-insensitively and keeping the first casing. */
  const mergeSkills = useCallback(
    (names: string[]): boolean => {
      let next = value;
      let changed = false;
      for (const raw of names) {
        const trimmed = raw.trim().slice(0, SKILL_MAX_LENGTH);
        if (!trimmed) continue;
        if (next.some((v) => sameSkill(v, trimmed))) continue;
        next = [...next, trimmed];
        changed = true;
      }
      if (changed) onChange(next);
      return changed;
    },
    [value, onChange]
  );

  /** Enter: adds exactly what was typed, or the library's casing of it on a case-insensitive
   *  match, so "docker" and "Docker" can't end up in the same list. */
  const commitInput = (): boolean => {
    const typed = text.trim().slice(0, SKILL_MAX_LENGTH);
    if (!typed) {
      setInputError('Type a skill name first');
      return false;
    }
    const libraryName = categories
      .flatMap((c) => c.skills)
      .find((s) => sameSkill(s.name, typed))?.name;
    const finalName = libraryName ?? typed;

    if (value.some((v) => sameSkill(v, finalName))) {
      setInputError(`"${finalName}" is already added`);
      return false;
    }
    mergeSkills([finalName]);
    setText('');
    setInputError(null);
    return true;
  };

  const handleCategoryChange = (nextId: string) => {
    if (isCategoryControlled) onCategoryChange?.(nextId);
    else setLocalCategoryId(nextId);
    const category = categories.find((c) => c.id === nextId);
    // Picking a role is a bulk convenience: it merges that role's skills into the selection and
    // never clears what is already there.
    if (category) mergeSkills(category.skills.map((s) => s.name));
    setInputError(null);
    // Focus is moved by the Select's own onCloseAutoFocus below, not here: Radix restores focus
    // to the trigger AFTER this handler returns, so anything done synchronously loses that race.
  };

  const clearAllSkills = () => {
    onChange([]);
    setText('');
    setInputError(null);
    // The category select is left as-is: clearing the skills is not the same as giving up on the
    // role, and "Deselect all" next to it must not reset an unrelated control.
  };

  const removeSkill = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    commitInput();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted.includes(',')) return;
    // A comma-separated paste is a bulk add, never one skill with commas in its name.
    e.preventDefault();
    const parts = pasted.split(',').map((p) => p.trim()).filter(Boolean);
    const added = mergeSkills(parts);
    if (!added) setInputError(`"${parts[0]}" is already added`);
    setText('');
  };

  const showEmptyState = value.length === 0 && !!selectedCategory;

  if (layout === 'side-by-side') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start">
        <div>
          {groupPicker}
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor={`${listId}-category`} className="text-[0.8rem] font-semibold text-[#475569]">
              {effectiveCategoryLabel}
              {required && <span className="text-[#dc2626]"> *</span>}
            </label>
          </div>
          <FormSelect
            small
            placeholder={libraryQuery.isLoading ? 'Loading skill groups…' : (categoryPlaceholder ?? 'Select a skill group (optional)')}
            disabled={libraryQuery.isLoading || libraryQuery.isError}
            allowClear={isCategoryControlled}
            clearLabel="None"
            options={categoryOptions}
            value={selectedCategoryId}
            onChange={handleCategoryChange}
            onCloseAutoFocus={(event) => {
              if (!isPointerDevice()) return;
              event.preventDefault();
              inputRef.current?.focus();
            }}
          />
          {suggestedCategoryIds && suggestedCategoryIds.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-[0.72rem] text-[#64748b]">
              <span>
                {showAllCategories
                  ? 'Showing all skill groups.'
                  : `Showing skill groups for ${suggestedReason || 'this demand type'}.`}
              </span>
              <button
                type="button"
                className="font-semibold text-[#2563eb] hover:underline"
                onClick={() => setShowAllCategories((v) => !v)}
              >
                {showAllCategories ? 'Show suggested only' : 'Show all'}
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[0.8rem] font-semibold text-[#475569]">Selected Skills</span>
            <div className="flex items-center gap-2">
              <span className="text-[0.75rem] font-medium text-[#94a3b8]">{value.length} selected</span>
              {value.length > 0 && (
                <button type="button" onClick={clearAllSkills} className="text-[0.75rem] font-semibold text-[#dc2626] hover:underline">
                  Deselect all
                </button>
              )}
            </div>
          </div>
          <div
            onClick={() => inputRef.current?.focus()}
            className={cn(
              'flex min-h-[38px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 transition-colors',
              'focus-within:border-[#2563eb] focus-within:ring-1 focus-within:ring-[#bfdbfe]',
              inputError || error ? 'border-[#fca5a5]' : 'border-[#e2e8f0]'
            )}
          >
            {value.map((name, index) => (
              <Badge
                key={`${name}-${index}`}
                className="gap-1 rounded border-transparent bg-[#eff6ff] px-2 py-0.5 text-[0.75rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]"
              >
                {name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSkill(index);
                  }}
                  aria-label={`Remove ${name}`}
                  className="ml-0.5 inline-flex items-center justify-center rounded-full hover:text-[#dc2626]"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {showEmptyState && (
              <span className="text-[0.8rem] text-[#94a3b8]">
                No skills selected.{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedCategory) mergeSkills(selectedCategory.skills.map((s) => s.name));
                    inputRef.current?.focus();
                  }}
                  className="font-semibold text-[#2563eb] hover:underline"
                >
                  Re-add {selectedCategory?.name} skills
                </button>
              </span>
            )}
            <input
              id={`${listId}-input`}
              ref={inputRef}
              type="text"
              value={text}
              maxLength={SKILL_MAX_LENGTH}
              onChange={(e) => {
                setText(e.target.value);
                if (inputError) setInputError(null);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              aria-label="Type a skill and press Enter"
              autoComplete="off"
              placeholder={value.length === 0 && !showEmptyState ? 'Type a skill and press Enter' : undefined}
              className="min-w-[120px] flex-1 border-none bg-transparent p-0 text-[0.85rem] outline-none placeholder:text-[#94a3b8]"
            />
          </div>
          {inputError && <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{inputError}</span>}
          {error && !inputError && <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        {label && (
          <label htmlFor={`${listId}-input`} className="text-[0.8rem] font-semibold text-[#475569]">
            {label}
            {required && <span className="text-[#dc2626]"> *</span>}
          </label>
        )}
        <span className="text-[0.75rem] font-medium text-[#94a3b8]">Selected: {value.length}</span>
      </div>

      {groupPicker}
      {categories.length > 0 && (
        <div className="mb-2">
          {hasGroups && <div className="mb-1 text-[0.8rem] font-semibold text-[#475569]">Skill Category</div>}
          <FormSelect
            small
            placeholder={libraryQuery.isLoading ? 'Loading skill groups…' : (categoryPlaceholder ?? 'Select a skill group (optional)')}
            disabled={libraryQuery.isLoading || libraryQuery.isError}
            // Clearing only matters where the category is saved, so Candidate keeps its old dropdown.
            allowClear={isCategoryControlled}
            clearLabel="None"
            options={categoryOptions}
            value={selectedCategoryId}
            onChange={handleCategoryChange}
            onCloseAutoFocus={(event) => {
              // After a role is picked the caret belongs in the skills box so the user can keep
              // typing. Radix would otherwise put it back on the trigger, so its restore is
              // cancelled and focus is handed over once, at the exact moment the close finishes —
              // no timer race. Touch devices keep the default: pulling up a software keyboard
              // unprompted mid-form is worse than leaving the caret on the trigger.
              if (!isPointerDevice()) return;
              event.preventDefault();
              inputRef.current?.focus();
            }}
          />
          {suggestedCategoryIds && suggestedCategoryIds.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-[0.72rem] text-[#64748b]">
              <span>
                {showAllCategories
                  ? 'Showing all skill groups.'
                  : `Showing skill groups for ${suggestedReason || 'this demand type'}.`}
              </span>
              <button
                type="button"
                className="font-semibold text-[#2563eb] hover:underline"
                onClick={() => setShowAllCategories((v) => !v)}
              >
                {showAllCategories ? 'Show suggested only' : 'Show all'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#94a3b8]">Selected skills</span>
        {value.length > 0 && (
          <button type="button" onClick={clearAllSkills} className="text-[0.75rem] font-semibold text-[#dc2626] hover:underline">
            Deselect all
          </button>
        )}
      </div>

      {/* The box is the control: chips and the caret share one bordered surface. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'flex w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-white px-2.5 py-2 transition-colors',
          'focus-within:border-[#2563eb] focus-within:ring-1 focus-within:ring-[#bfdbfe]',
          inputError || error ? 'border-[#fca5a5]' : 'border-[#e2e8f0]'
        )}
      >
        {value.map((name, index) => (
          <Badge
            key={`${name}-${index}`}
            className="gap-1 rounded border-transparent bg-[#eff6ff] px-2 py-0.5 text-[0.75rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]"
          >
            {name}
            <button
              type="button"
              onClick={(e) => {
                // Otherwise the box's own onClick would fire and yank focus back to the input.
                e.stopPropagation();
                removeSkill(index);
              }}
              aria-label={`Remove ${name}`}
              className="ml-0.5 inline-flex items-center justify-center rounded-full hover:text-[#dc2626]"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {/* Empty-after-"Deselect all" hint. The input stays alongside it rather than instead of
            it, so the user can keep typing instead of re-adding the category first. */}
        {showEmptyState && (
          <span className="text-[0.8rem] text-[#94a3b8]">
            No skills selected.{' '}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (selectedCategory) mergeSkills(selectedCategory.skills.map((s) => s.name));
                inputRef.current?.focus();
              }}
              className="font-semibold text-[#2563eb] hover:underline"
            >
              Re-add {selectedCategory?.name} skills
            </button>
          </span>
        )}

        <input
          id={`${listId}-input`}
          ref={inputRef}
          type="text"
          value={text}
          maxLength={SKILL_MAX_LENGTH}
          onChange={(e) => {
            setText(e.target.value);
            if (inputError) setInputError(null);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          aria-label={label ? `${label} — type a skill and press Enter` : 'Type a skill and press Enter'}
          autoComplete="off"
          placeholder={value.length === 0 && !showEmptyState ? 'Pick a role above, or type a skill and press Enter' : undefined}
          className="min-w-[140px] flex-1 border-none bg-transparent p-0 text-[0.85rem] outline-none placeholder:text-[#94a3b8]"
        />
      </div>

      {inputError && <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{inputError}</span>}
      {!inputError && error && <span className="mt-1 block text-[0.72rem] text-[#dc2626]">{error}</span>}
    </div>
  );
}