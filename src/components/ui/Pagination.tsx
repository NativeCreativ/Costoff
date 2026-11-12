'use client';

import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  /** Total item count, used to render "Showing X-Y of Z {itemLabel}" before the Rows-per-page control. */
  total?: number;
  /** Plural label for the items being paginated, e.g. "users", "demands". Defaults to "results". */
  itemLabel?: string;
  className?: string;
}

const WINDOW_SIZE = 6;

/** Windowed page-number range around the current page (max WINDOW_SIZE buttons). */
function getPageRange(page: number, totalPages: number): number[] {
  if (totalPages <= WINDOW_SIZE) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  let start = Math.max(1, page - Math.floor((WINDOW_SIZE - 1) / 2));
  const end = Math.min(totalPages, start + WINDOW_SIZE - 1);
  start = Math.max(1, end - WINDOW_SIZE + 1);

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({ page, totalPages, onPageChange, pageSize, onPageSizeChange, pageSizeOptions, total, itemLabel = 'results', className }: PaginationProps) {
  const showRowsPerPage = pageSize !== undefined && !!onPageSizeChange && !!pageSizeOptions?.length;

  if (totalPages <= 1 && !showRowsPerPage) return null;

  const pageRange = getPageRange(page, totalPages);
  const showSummary = total !== undefined && total > 0 && pageSize !== undefined;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ''}`}>
      {showRowsPerPage ? (
        <div className="flex flex-wrap items-center gap-3 text-[0.8rem] text-[#475569]">
          {showSummary && (
            <span className="font-medium text-[#2563eb]">
              Showing {(page - 1) * pageSize! + 1}-{Math.min(page * pageSize!, total!)} of {total} {itemLabel}
            </span>
          )}
          <div className="flex items-center gap-2">
            <span className="font-semibold">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange!(Number(e.target.value))}
              className="button-select button-select-sm"
            >
              {pageSizeOptions!.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <span />
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="h-8 rounded-md border-[#e2e8f0] px-3 text-[0.8rem] font-semibold"
          >
            Previous
          </Button>

          {pageRange.map((p) => (
            <Button
              key={p}
              variant="outline"
              size="sm"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`h-8 min-w-[32px] rounded-md px-2.5 text-[0.8rem] font-semibold ${
                p === page
                  ? 'border-[#2563eb] bg-[#2563eb] text-white hover:bg-[#2563eb]/90'
                  : 'border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]'
              }`}
            >
              {p}
            </Button>
          ))}

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-8 rounded-md border-[#e2e8f0] px-3 text-[0.8rem] font-semibold"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
