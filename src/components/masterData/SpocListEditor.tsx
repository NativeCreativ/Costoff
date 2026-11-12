'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ClientSpocItem } from './spoc.schema';

interface SpocListEditorProps {
  value: ClientSpocItem[];
  onChange: (next: ClientSpocItem[]) => void;
  disabled?: boolean;
  error?: string;
  /** `client` adds Vertical, Supervisor, Supervisor Designation and the Active switch. End
   *  clients keep the original four fields. */
  variant?: 'client' | 'end_client';
}

const EMPTY: ClientSpocItem = { name: '', email: '', phone: '', designation: '' };
const EMPTY_CLIENT: ClientSpocItem = { ...EMPTY, vertical: '', supervisor: '', supervisor_designation: '', is_active: true };

/** Repeating client-contact rows. Blank rows are dropped by the API. */
export function SpocListEditor({ value, onChange, disabled, error, variant = 'end_client' }: SpocListEditorProps) {
  const isClient = variant === 'client';
  const update = (index: number, patch: Partial<ClientSpocItem>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 && (
        <p className="text-[0.78rem] text-[#94a3b8]">No SPOCs yet. Add the people the demand team should contact.</p>
      )}
      {value.map((row, index) => {
        const isActive = row.is_active !== false;
        return (
          <div
            key={row.id || index}
            className={cn('flex flex-col gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2', isClient && !isActive && 'opacity-70')}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_1.2fr_0.9fr_0.9fr_auto]">
              <Input
                value={row.name}
                disabled={disabled}
                placeholder="Name"
                onChange={(e) => update(index, { name: e.target.value })}
                className="h-9 bg-white"
              />
              <Input
                value={row.email ?? ''}
                disabled={disabled}
                placeholder="Email"
                onChange={(e) => update(index, { email: e.target.value })}
                className="h-9 bg-white"
              />
              <Input
                value={row.phone ?? ''}
                disabled={disabled}
                placeholder="Phone"
                onChange={(e) => update(index, { phone: e.target.value })}
                className="h-9 bg-white"
              />
              <Input
                value={row.designation ?? ''}
                disabled={disabled}
                placeholder="Designation"
                onChange={(e) => update(index, { designation: e.target.value })}
                className="h-9 bg-white"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label="Remove SPOC"
                title={isClient ? 'Remove. A SPOC already used on a demand is kept as Inactive instead.' : 'Remove'}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {isClient && (
              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1.2fr_1.2fr_0.9fr_0.9fr_auto]">
                <Input
                  value={row.vertical ?? ''}
                  disabled={disabled}
                  placeholder="Vertical"
                  onChange={(e) => update(index, { vertical: e.target.value })}
                  className="h-9 bg-white"
                />
                <Input
                  value={row.supervisor ?? ''}
                  disabled={disabled}
                  placeholder="Supervisor"
                  onChange={(e) => update(index, { supervisor: e.target.value })}
                  className="h-9 bg-white"
                />
                <Input
                  value={row.supervisor_designation ?? ''}
                  disabled={disabled}
                  placeholder="Supervisor designation"
                  onChange={(e) => update(index, { supervisor_designation: e.target.value })}
                  className="h-9 bg-white"
                />
                <div className="flex items-center gap-2">
                  {/* Same switch styling as SettingsItemRowActions' Active/Inactive toggle. */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    aria-label={isActive ? `Mark ${row.name || 'SPOC'} inactive` : `Mark ${row.name || 'SPOC'} active`}
                    disabled={disabled}
                    onClick={() => update(index, { is_active: !isActive })}
                    className={cn(
                      'relative inline-flex h-4 w-7 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      isActive ? 'bg-[#2563eb]' : 'bg-[#cbd5e1]'
                    )}
                  >
                    <span className={cn('inline-block h-3 w-3 transform rounded-full bg-white transition-transform', isActive ? 'translate-x-3.5' : 'translate-x-0.5')} />
                  </button>
                  {isActive ? (
                    <span className="text-[0.78rem] text-[#475569]">Active</span>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
                <span />
              </div>
            )}
          </div>
        );
      })}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-1.5"
          onClick={() => onChange([...value, { ...(isClient ? EMPTY_CLIENT : EMPTY) }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add SPOC
        </Button>
      )}
      {error && <p className="text-[0.75rem] text-[#dc2626]">{error}</p>}
    </div>
  );
}
