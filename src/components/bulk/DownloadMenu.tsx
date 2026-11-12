'use client';

import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface DownloadMenuItem {
  label: string;
  href: string;
}

interface DownloadMenuProps {
  /** Button caption, e.g. "Export" or "Download Template". */
  label: string;
  title?: string;
  items: DownloadMenuItem[];
  /** Optional icon class, matching the surrounding toolbar (Font Awesome, as used by the other toolbar buttons). */
  iconClass?: string;
}

/**
 * Toolbar dropdown of same-origin download links — the one place a list screen offers
 * "Excel" / "CSV" variants. The hrefs are plain URLs, so the browser attaches the session
 * cookie itself and no fetch/blob plumbing is needed.
 */
export function DownloadMenu({ label, title, items, iconClass }: DownloadMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="toolbar-btn"
          title={title}
        >
          {iconClass && <i className={`fa-solid ${iconClass} mr-1.5`}></i>}
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            download
            onClick={() => setOpen(false)}
            className="block rounded px-3 py-2 text-[0.82rem] text-[#334155] hover:bg-[#f8fafc]"
          >
            {item.label}
          </a>
        ))}
      </PopoverContent>
    </Popover>
  );
}