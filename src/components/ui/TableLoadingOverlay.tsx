'use client';

interface TableLoadingOverlayProps {
  show: boolean;
  message?: string;
}

/** Opaque loading overlay for a `relative` table container. */
export function TableLoadingOverlay({ show, message }: TableLoadingOverlayProps) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white">
      <i className="fa-solid fa-spinner fa-spin text-[2.2rem] text-[#2563eb]"></i>
      {message && <p className="text-[0.9rem] font-semibold text-[#64748b]">{message}</p>}
    </div>
  );
}
