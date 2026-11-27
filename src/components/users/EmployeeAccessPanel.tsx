'use client';

import { useEffect, useMemo, useState } from 'react';
import { UserCog } from 'lucide-react';
import { FormSelect } from '@/components/ui/FormSelect';
import { Button } from '@/components/ui/button';
import { useUsersQuery } from '@/queries/users/useUsersQuery';
import { useSetUserAccessMutation } from '@/queries/users/useUserMutations';
import { ACCESS_MODULES, sanitizeBlockedModules } from '@/lib/auth/moduleAccess';
import { USER_ROLE_OPTIONS } from '@/constants/options';

const roleLabel = (role: string) => USER_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;

const MODULE_GROUPS = Array.from(new Set(ACCESS_MODULES.map((m) => m.group)));

/**
 * Employee access: the Delivery Head picks an employee and switches screens on or off for them.
 * Delivery Heads (super_admin) always have every screen and are not listed.
 */
export function EmployeeAccessPanel() {
  const usersQuery = useUsersQuery({ pageSize: 100 });
  const employees = useMemo(
    () => (usersQuery.data?.data ?? []).filter((u) => u.role !== 'super_admin').sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [usersQuery.data]
  );

  const [employeeId, setEmployeeId] = useState('');
  const employee = employees.find((e) => e.id === employeeId);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [savedMessage, setSavedMessage] = useState('');
  const mutation = useSetUserAccessMutation();

  useEffect(() => {
    setBlocked(sanitizeBlockedModules(employee?.blocked_modules));
    setSavedMessage('');
    mutation.reset();
    // Reload the toggles only when another employee is picked (or their saved list changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, employee?.blocked_modules?.join(',')]);

  const savedBlocked = sanitizeBlockedModules(employee?.blocked_modules);
  const isDirty = savedBlocked.join(',') !== sanitizeBlockedModules(blocked).join(',');

  const toggle = (key: string, on: boolean) => {
    setSavedMessage('');
    setBlocked((prev) => (on ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const save = () => {
    if (!employee) return;
    mutation.mutate(
      { id: employee.id, blockedModules: sanitizeBlockedModules(blocked) },
      { onSuccess: () => setSavedMessage(`Access saved for ${employee.full_name}.`) }
    );
  };

  const errorMessage =
    (mutation.error as { response?: { data?: { error?: string } } } | null)?.response?.data?.error ??
    (mutation.error ? 'Could not save access. Try again.' : '');

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--card-border)] bg-white shadow-[var(--card-shadow)]">
      <div className="flex flex-col gap-1 border-b border-[color:var(--card-border)] px-[22px] py-[18px]">
        <h2 className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-[-0.2px] text-[#0f172a]">
          <UserCog className="h-5 w-5 text-[#2563eb]" />
          Employee Access
        </h2>
        <p className="text-[0.8rem] text-[#64748b]">
          Pick an employee and switch screens on or off for them. Delivery Heads always have full access. Master data, users and
          settings stay Delivery Head only.
        </p>
      </div>

      <div className="flex flex-col gap-4 px-[22px] py-[18px]">
        <div className="max-w-md">
          <FormSelect
            label="Employee"
            placeholder={usersQuery.isLoading ? 'Loading employees…' : 'Select an employee'}
            options={employees.map((e) => ({ value: e.id, label: `${e.full_name} — ${roleLabel(e.role)}` }))}
            value={employeeId}
            onChange={setEmployeeId}
          />
        </div>

        {employee ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {MODULE_GROUPS.map((group) => (
                <div key={group} className="rounded-lg border border-[#e2e8f0] p-3">
                  <div className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.8px] text-[#64748b]">{group}</div>
                  <ul className="flex flex-col gap-2">
                    {ACCESS_MODULES.filter((m) => m.group === group).map((m) => {
                      const on = !blocked.includes(m.key);
                      return (
                        <li key={m.key} className="flex items-center justify-between gap-3">
                          <label htmlFor={`access-${m.key}`} className={`text-[0.84rem] ${on ? 'text-[#0f172a]' : 'text-[#94a3b8] line-through'}`}>
                            {m.label}
                          </label>
                          <button
                            id={`access-${m.key}`}
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label={`${m.label} access`}
                            onClick={() => toggle(m.key, !on)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-[#2563eb]' : 'bg-[#cbd5e1]'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {errorMessage && <span className="text-[0.8rem] text-[#dc2626]">{errorMessage}</span>}
              {savedMessage && !isDirty && <span className="text-[0.8rem] text-[#16a34a]">{savedMessage}</span>}
              <Button type="button" variant="outline" disabled={!isDirty || mutation.isPending} onClick={() => setBlocked(savedBlocked)} className="h-auto rounded-md px-4 py-2 font-normal">
                Undo changes
              </Button>
              <Button type="button" disabled={!isDirty || mutation.isPending} onClick={save} className="h-auto rounded-md px-4 py-2 font-semibold">
                {mutation.isPending ? 'Saving…' : 'Save access'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-[0.83rem] text-[#94a3b8]">
            {!usersQuery.isLoading && employees.length === 0 ? 'No employees yet. Add them on the Users page.' : 'Select an employee to see their access.'}
          </p>
        )}
      </div>
    </div>
  );
}
