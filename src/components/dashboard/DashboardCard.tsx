'use client';

import type { ReactNode } from 'react';

/**
 * Shared card chrome for the Org Overview dashboard (DESIGN SPEC):
 * white card, 1px #e2e8f0 border, 12px radius, spec shadow, overflow
 * hidden; header bar (16px 22px) with title + subtitle on the left and
 * a link/legend slot on the right; body padding 20px 22px.
 *
 * Every card renders all three states — loading skeleton, error and
 * empty (short message + muted icon) — driven by `state`/`empty`.
 */

export type DashboardCardState = 'loading' | 'error' | 'ready';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  /** Right side of the header bar: a link (13px/600 blue) or a legend. */
  right?: ReactNode;
  state: DashboardCardState;
  /** Render the empty state instead of children (only when state is 'ready'). */
  empty?: boolean;
  emptyMessage?: string;
  /** Font Awesome icon class for the empty state (muted). */
  emptyIcon?: string;
  /**
   * When true, the body has no horizontal/vertical padding so tables can
   * sit edge-to-edge. Loading / error / empty states keep padded chrome.
   */
  flush?: boolean;
  /** Extra classes on the card shell (e.g. the red top border). */
  className?: string;
  /** Extra classes on the body wrapper. */
  bodyClassName?: string;
  children: ReactNode;
}

const CARD_CLASS =
  'overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]';

function CardSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading">
      <div className="h-3 w-1/3 rounded bg-[#f1f5f9]" />
      <div className="h-6 w-2/3 rounded bg-[#f1f5f9]" />
      <div className="h-3 w-1/2 rounded bg-[#f1f5f9]" />
      <div className="h-24 rounded bg-[#f1f5f9]" />
    </div>
  );
}

function CardError() {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <i className="fa-solid fa-triangle-exclamation block text-xl text-[#cbd5e1]" />
      <p className="text-sm text-[#64748b]">Couldn&apos;t load this section.</p>
    </div>
  );
}

function CardEmpty({ message, icon }: { message: string; icon: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <i className={`${icon} block text-xl text-[#cbd5e1]`} />
      <p className="text-sm text-[#64748b]">{message}</p>
    </div>
  );
}

export function DashboardCard({
  title,
  subtitle,
  right,
  state,
  empty,
  emptyMessage = 'No data yet.',
  emptyIcon = 'fa-solid fa-folder-open',
  flush = false,
  className,
  bodyClassName,
  children,
}: DashboardCardProps) {
  const showPaddedChrome = state !== 'ready' || empty;
  const bodyPad = showPaddedChrome || !flush ? 'px-[22px] py-5' : '';

  return (
    <section className={`${CARD_CLASS} h-full flex flex-col ${className ?? ''}`}>
      <header className="flex items-start justify-between gap-4 border-b border-[#e2e8f0] px-[22px] py-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-[-0.2px] text-[#0f172a]">{title}</h2>
          {subtitle ? <p className="mt-[3px] text-xs text-[#64748b]">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex shrink-0 items-center gap-4">{right}</div> : null}
      </header>
      <div className={`min-h-0 flex-1 ${bodyPad} ${bodyClassName ?? ''}`}>
        {state === 'loading' ? (
          <CardSkeleton />
        ) : state === 'error' ? (
          <CardError />
        ) : empty ? (
          <CardEmpty message={emptyMessage} icon={emptyIcon} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/** Card header link — 13px, weight 600, #2563eb. */
export function CardLink({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  if (href) {
    return (
      <a
        href={href}
        className="cursor-pointer text-[13px] font-semibold text-[#2563eb] no-underline transition-colors duration-200 hover:text-[#1d4ed8] hover:underline"
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer border-none bg-none p-0 text-[13px] font-semibold text-[#2563eb] no-underline transition-colors duration-200 hover:text-[#1d4ed8] hover:underline"
    >
      {children}
    </button>
  );
}
