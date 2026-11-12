"use client";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
  columnWidths?: string[];
  padded?: boolean;
  /** Per-row min-height in px, so skeleton matches tall real rows (e.g. multi-line cells). */
  rowMinHeight?: number;
}

const DEFAULT_WIDTHS = [
  "w-20",
  "w-32",
  "w-28",
  "w-24",
  "w-16",
  "w-20",
  "w-24",
  "w-16",
];

export function TableSkeleton({
  columns,
  rows = 10,
  columnWidths,
  padded,
  rowMinHeight,
}: TableSkeletonProps) {
  const widths = columnWidths ?? DEFAULT_WIDTHS;

  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse" style={rowMinHeight ? { height: rowMinHeight } : undefined}>
          {Array.from({ length: columns }, (_, colIndex) => (
            <td key={colIndex} className={padded ? "px-4 py-3" : undefined}>
              <div
                className={`h-3.5 rounded bg-[#e2e8f0] ${widths[colIndex % widths.length]}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
