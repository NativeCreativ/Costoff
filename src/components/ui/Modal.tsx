'use client';

import { ReactNode, createContext, useContext, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';

/** Sidebar.tsx's expanded width (`w-[270px]`, `fixed left-0`) — kept in sync here so a wide
 *  modal can center itself in the content area to the right of the sidebar instead of the
 *  full viewport, which otherwise drifts a wide/centered modal left, under the sidebar. */
const SIDEBAR_WIDTH_PX = 270;

/**
 * A slot rendered as a direct child of the modal's outer frame (the `relative flex min-h-0 flex-1 flex-col` div),
 * which is the positioning context for the drawer. This allows the drawer to cover the full modal height
 * including the header area, and stay fixed while the content scrolls.
 * The slot div is `display: contents` so it introduces no box of its own.
 */
const ModalDrawerSlotContext = createContext<HTMLElement | null>(null);

/** Returns the modal's drawer slot element, or `null` outside a `Modal` (or before it mounts). */
export function useModalDrawerSlot(): HTMLElement | null {
  return useContext(ModalDrawerSlotContext);
}

interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  width?: string;
  /** 'default' keeps the existing fixed-width behavior; 'large' is a wide card (w-[96vw], capped at 1600px) that grows to fit its content, up to 92vh before it scrolls. */
  size?: 'default' | 'large';
  onClose: () => void;
  /** Disables the X button and outside/Escape close while a create/update/delete request is in flight. */
  closeDisabled?: boolean;
  /** Centers the modal within the content area to the right of the fixed sidebar instead of
   *  the full viewport — for wide modals (size="large" or a large fixed `width`) that would
   *  otherwise visually touch/overlap the sidebar when centered on 100vw. Narrower modals
   *  don't need this; left as opt-in so their existing centering is untouched. */
  offsetForSidebar?: boolean;
  /** When true, locks scrolling of the modal's content area (used when a drawer is open). */
  lockContentScroll?: boolean;
  children: ReactNode;
}

export function Modal({ title, subtitle, width = '580px', size = 'default', onClose, closeDisabled, offsetForSidebar, lockContentScroll, children }: ModalProps) {
  const isLarge = size === 'large';
  // State triggers a re-render once the slot mounts so any portal waiting on it gets the real node
  const [drawerSlot, setDrawerSlot] = useState<HTMLElement | null>(null);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !closeDisabled) onClose(); }}>
      <DialogContent
        style={{
          ...(isLarge ? undefined : { width }),
          ...(offsetForSidebar ? { left: `calc(50% + ${SIDEBAR_WIDTH_PX / 2}px)` } : undefined),
        }}
        className={`p-0 ${isLarge ? 'max-h-[92vh] w-[96vw] max-w-[1600px]' : 'w-full'}`}
      >
        <div className="relative flex min-h-0 flex-1 flex-col p-6">
          <ModalDrawerSlotContext.Provider value={drawerSlot}>
            <DialogHeader className="shrink-0" closeDisabled={closeDisabled}>
              <div className="min-w-0 pr-3">
                <DialogTitle>{title}</DialogTitle>
                {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
              </div>
            </DialogHeader>
            <div
              className={`relative min-h-0 flex-1 pr-1 ${lockContentScroll ? 'overflow-hidden' : 'overflow-y-auto'}`}
              style={lockContentScroll ? { pointerEvents: 'none' } : undefined}
            >
              {children}
            </div>
            {/* Slot for the drawer - direct child of the outer frame (positioning context) */}
            <div ref={setDrawerSlot} className="contents" />
          </ModalDrawerSlotContext.Provider>
        </div>
      </DialogContent>
    </Dialog>
  );
}