'use client';

import { useState } from 'react';

interface MoreLessTextProps {
  text: string;
  wordLimit?: number;
  /** Char cap as a fallback for a single long word with no spaces. */
  charLimit?: number;
  className?: string;
}

export function MoreLessText({ text, wordLimit = 20, charLimit = 140, className }: MoreLessTextProps) {
  const [expanded, setExpanded] = useState(false);
  const words = text.split(/\s+/).filter(Boolean);
  const byWords = words.length > wordLimit;
  const byChars = text.length > charLimit;
  const isTruncatable = byWords || byChars;

  const truncated = byWords ? words.slice(0, wordLimit).join(' ') : text;
  const displayText = expanded || !isTruncatable ? text : truncated.slice(0, charLimit).trimEnd() + '…';

  return (
    <span className={`break-words [overflow-wrap:anywhere] ${className ?? ''}`}>
      {displayText}
      {isTruncatable && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="ml-1 cursor-pointer border-none bg-none p-0 text-[0.75rem] font-semibold text-[#2563eb] hover:underline"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </span>
  );
}
