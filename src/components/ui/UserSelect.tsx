'use client';

// UserSelect has been generalized into EntitySelect (src/components/ui/EntitySelect.tsx) to
// support non-user entities (Demand, Candidate) with async DB-backed search. This file is kept
// as a thin backward-compatible alias so existing call sites (AM/SPOC/recruiter pickers, the
// Interviewer picker) don't need to change.
import { EntitySelect, EntityOption } from './EntitySelect';

/** @deprecated Use EntityOption from EntitySelect instead. Kept as an alias for existing imports. */
export type UserSelectOption = EntityOption & { name: string; email?: string; role?: string };

interface UserSelectBaseProps {
  options: { id: string; name: string; email?: string; role?: string }[];
  label?: string;
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  error?: string;
  disabled?: boolean;
  isLoading?: boolean;
  emptyLabel?: string;
  selectedLabel?: string;
}

interface UserSelectSingleProps extends UserSelectBaseProps {
  mode: 'single';
  value: string;
  onChange: (value: string) => void;
}

interface UserSelectMultipleProps extends UserSelectBaseProps {
  mode: 'multiple';
  value: string[];
  onChange: (value: string[]) => void;
}

type UserSelectProps = UserSelectSingleProps | UserSelectMultipleProps;

/** @deprecated Use EntitySelect directly for new call sites. Kept for existing user-shaped callers. */
export function UserSelect(props: UserSelectProps) {
  const options = props.options.map((o) => ({ id: o.id, label: o.name, sublabel: o.email, tag: o.role }));
  return <EntitySelect {...(props as any)} options={options} />;
}
