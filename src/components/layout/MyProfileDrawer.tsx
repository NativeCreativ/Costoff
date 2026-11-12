'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, LogOut } from 'lucide-react';
import { Profile } from '@/components/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { USER_ROLE_OPTIONS } from '@/constants/options';
import { formatDate, formatScheduledDate } from '@/lib/utils';
import { useChangeUserPasswordMutation } from '@/queries/users/useUserMutations';
import { useLogoutMutation } from '@/queries/auth/useLogoutMutation';

interface MyProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  currentUser: Profile | null;
  isLoading?: boolean;
}

function roleLabel(role?: string) {
  return USER_ROLE_OPTIONS.find((opt) => opt.value === role)?.label || role || '—';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function MyProfileDrawer({ open, onClose, currentUser, isLoading }: MyProfileDrawerProps) {
  const changePasswordMutation = useChangeUserPasswordMutation();
  const logoutMutation = useLogoutMutation();

  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState({ oldPassword: false, newPassword: false, confirmPassword: false });

  useEffect(() => {
    if (!open) {
      setChangingPassword(false);
      setPasswordDraft({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordError(null);
      setPasswordSuccess(false);
      setShowPassword({ oldPassword: false, newPassword: false, confirmPassword: false });
    }
  }, [open]);

  if (!open) return null;

  // While logging out, block close (cross button / outside click) until the redirect to /login fires.
  const handleClose = () => {
    if (logoutMutation.isPending) return;
    onClose();
  };

  const savePassword = () => {
    if (!currentUser) return;
    if (passwordDraft.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setPasswordError(null);
    changePasswordMutation.mutate(
      {
        id: currentUser.id,
        oldPassword: passwordDraft.oldPassword,
        newPassword: passwordDraft.newPassword,
        confirmPassword: passwordDraft.confirmPassword,
      },
      {
        onSuccess: () => {
          setPasswordSuccess(true);
          setPasswordDraft({ oldPassword: '', newPassword: '', confirmPassword: '' });
          setTimeout(() => {
            setChangingPassword(false);
            setPasswordSuccess(false);
          }, 1200);
        },
        onError: (err: unknown) => {
          const message =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to change password';
          setPasswordError(message);
        },
      }
    );
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-[2000] flex justify-end bg-[rgba(15,23,42,0.65)] backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[420px] max-w-[90vw] flex-col bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.25)]"
      >
        <div className="flex items-center justify-between bg-[#0f172a] px-6 py-5 text-white">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-user-gear text-[#38bdf8]"></i>
            <h2 className="text-[1.1rem] font-bold text-[#f8fafc]">My Profile</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={logoutMutation.isPending}
            className="flex h-8 w-8 items-center justify-center rounded-full border-none bg-white/10 text-[1.1rem] text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="p-[60px] text-center text-[#64748b]">
              <i className="fa-solid fa-spinner fa-spin mb-3 text-2xl text-[#2563eb]"></i>
              <p className="font-semibold">Loading profile...</p>
            </div>
          ) : !currentUser ? (
            <div className="p-10 text-center text-[#dc2626]">
              <i className="fa-solid fa-circle-exclamation mb-2.5 text-2xl"></i>
              <p>Could not load profile details.</p>
            </div>
          ) : (
            <>
              {/* Contact Card — read-only for everyone in My Profile */}
              <div className="rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-4">
                <div className="mb-3 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">
                  Profile
                </div>
                <div className="flex flex-col items-center gap-2.5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2563eb] text-[1.3rem] font-bold text-white">
                    {initials(currentUser.full_name)}
                  </div>
                  <div className="text-center">
                    <div className="text-[1.05rem] font-bold text-[#0f172a]">{currentUser.full_name}</div>
                    <div className="text-[0.82rem] text-[#64748b]">{currentUser.email}</div>
                    <div className="text-[0.82rem] text-[#64748b]">{currentUser.phone || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Access Card — read-only for everyone in My Profile */}
              <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
                <div className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">
                  Role & Status
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="mb-1 block text-[0.78rem] text-[#64748b]">Role</span>
                    <Badge className="rounded border-transparent bg-[#eff6ff] text-[0.75rem] font-semibold text-[#2563eb] hover:bg-[#eff6ff]">
                      {roleLabel(currentUser.role)}
                    </Badge>
                  </div>
                  <div>
                    <span className="mb-1 block text-[0.78rem] text-[#64748b]">Status</span>
                    <Badge className="rounded border-transparent bg-[#ecfdf5] text-[0.75rem] font-semibold text-[#10b981] hover:bg-[#ecfdf5]">
                      {currentUser.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Account Details */}
              <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
                <div className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">
                  Account Details
                </div>
                <div className="flex items-center justify-between border-b border-[#f1f5f9] py-2.5">
                  <span className="text-[0.8rem] text-[#64748b]">Date of Joining</span>
                  <span className="text-[0.85rem] font-semibold text-[#0f172a]">
                    {currentUser.date_of_joining ? formatScheduledDate(currentUser.date_of_joining) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-[0.8rem] text-[#64748b]">Member Since</span>
                  <span className="text-[0.85rem] font-semibold text-[#0f172a]">{formatDate(currentUser.created_at)}</span>
                </div>
              </div>

              {/* Change Password */}
              <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
                {!changingPassword ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setChangingPassword(true)}
                    className="h-auto w-full gap-1.5 rounded-md border-[#e2e8f0] px-3 py-2 text-[0.83rem] font-semibold text-[#7c3aed] hover:bg-[#f5f3ff]"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Change Password
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.05em] text-[#2563eb]">
                      Change Password
                    </span>
                    <div>
                      <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">Current Password</label>
                      <div className="relative">
                        <Input
                          type={showPassword.oldPassword ? 'text' : 'password'}
                          placeholder="Current password"
                          value={passwordDraft.oldPassword}
                          onChange={(e) => setPasswordDraft((d) => ({ ...d, oldPassword: e.target.value }))}
                          className="h-auto rounded-md px-2.5 py-2 pr-9 text-[0.83rem] shadow-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => ({ ...s, oldPassword: !s.oldPassword }))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
                          tabIndex={-1}
                          aria-label={showPassword.oldPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword.oldPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">New Password</label>
                      <div className="relative">
                        <Input
                          type={showPassword.newPassword ? 'text' : 'password'}
                          placeholder="Minimum 8 characters"
                          value={passwordDraft.newPassword}
                          onChange={(e) => setPasswordDraft((d) => ({ ...d, newPassword: e.target.value }))}
                          className="h-auto rounded-md px-2.5 py-2 pr-9 text-[0.83rem] shadow-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => ({ ...s, newPassword: !s.newPassword }))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
                          tabIndex={-1}
                          aria-label={showPassword.newPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword.newPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[0.78rem] font-semibold text-[#475569]">Confirm New Password</label>
                      <div className="relative">
                        <Input
                          type={showPassword.confirmPassword ? 'text' : 'password'}
                          placeholder="Re-enter new password"
                          value={passwordDraft.confirmPassword}
                          onChange={(e) => setPasswordDraft((d) => ({ ...d, confirmPassword: e.target.value }))}
                          className="h-auto rounded-md px-2.5 py-2 pr-9 text-[0.83rem] shadow-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => ({ ...s, confirmPassword: !s.confirmPassword }))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
                          tabIndex={-1}
                          aria-label={showPassword.confirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword.confirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    {passwordError && <span className="text-[0.72rem] text-[#dc2626]">{passwordError}</span>}
                    {passwordSuccess && <span className="text-[0.72rem] font-semibold text-[#16a34a]">Password changed successfully</span>}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { setChangingPassword(false); setPasswordError(null); setPasswordDraft({ oldPassword: '', newPassword: '', confirmPassword: '' }); }}
                        className="h-auto rounded-md border-[#e2e8f0] px-3 py-1.5 text-[0.8rem] font-normal"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={savePassword}
                        disabled={changePasswordMutation.isPending}
                        className="h-auto rounded-md px-3 py-1.5 text-[0.8rem] font-semibold"
                      >
                        {changePasswordMutation.isPending ? 'Saving…' : 'Save Password'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Logout */}
              <Button
                type="button"
                variant="outline"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="h-auto w-full gap-1.5 rounded-md border-[#fecaca] px-3 py-2 text-[0.83rem] font-semibold text-[#dc2626] hover:bg-[#fef2f2]"
              >
                <LogOut className="h-3.5 w-3.5" />
                {logoutMutation.isPending ? 'Logging out…' : 'Logout'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
