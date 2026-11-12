'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Minimal toast notifications.
 *
 * The project had no toast library and no notification system at all, so this is a small
 * purpose-built one rather than a new dependency. It deliberately reuses the app's existing
 * colour tokens and the same inline banner styling the modals already use, so success/error
 * feedback looks native.
 *
 * Every non-inline outcome (a create that saved, a duplicate that was refused, an API error)
 * now has a visible channel — previously those either failed silently or rendered below a
 * scrollable form where the user could not see them.
 */

export type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (variant: ToastVariant, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { icon: ReactNode; ring: string; iconColor: string }> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    ring: 'border-[#bbf7d0] bg-[#f0fdf4]',
    iconColor: 'text-[#16a34a]',
  },
  error: {
    icon: <AlertTriangle className="h-4 w-4" />,
    ring: 'border-[#fca5a5] bg-[#fef2f2]',
    iconColor: 'text-[#dc2626]',
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    ring: 'border-[#bfdbfe] bg-[#eff6ff]',
    iconColor: 'text-[#2563eb]',
  },
};

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const [mounted, setMounted] = useState(false);

  // Portals need a DOM; render nothing on the server.
  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, variant, title, description }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast('success', title, description),
      error: (title, description) => toast('error', title, description),
      info: (title, description) => toast('info', title, description),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[380px] max-w-[calc(100vw-2.5rem)] flex-col gap-2.5">
            {toasts.map((t) => {
              const style = VARIANT_STYLES[t.variant];
              return (
                <div
                  key={t.id}
                  role="status"
                  aria-live="polite"
                  className={`pointer-events-auto flex animate-pulse items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-lg ${style.ring}`}
                >
                  <span className={`mt-0.5 shrink-0 ${style.iconColor}`}>{style.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.83rem] font-bold text-[#0f172a]">{t.title}</div>
                    {t.description && (
                      <div className="mt-0.5 break-words text-[0.78rem] text-[#475569]">{t.description}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss notification"
                    className="shrink-0 text-[#94a3b8] transition-colors hover:text-[#475569]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

/** Returns the toast helpers. Throws if used outside <ToastProvider> so a missing provider is
 *  caught loudly during development rather than silently dropping feedback. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>');
  }
  return ctx;
}