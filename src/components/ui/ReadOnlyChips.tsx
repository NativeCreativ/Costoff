'use client';

export const ReadOnlyChips = ({
  items,
}: {
  items?: string[];
}) => {
  if (!items?.length) {
    return <span className="text-sm text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
};