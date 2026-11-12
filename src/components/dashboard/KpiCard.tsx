'use client';

interface KpiCardProps {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  subLine?: string | null;
  subLineColor?: string;
  onClick?: () => void;
  isLoading?: boolean;
  error?: Error | null;
}

function formatNumber(num: number | null): string {
  if (num === null) return '—';
  return num.toLocaleString();
}

export function KpiCard({
  label,
  value,
  icon,
  iconBgColor,
  iconColor,
  subLine,
  subLineColor = '#64748b',
  onClick,
  isLoading,
  error,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-xl border bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] animate-pulse"
        style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px', borderColor: '#e2e8f0' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f1f5f9]" />
          <div className="h-4 w-[100px] bg-[#f1f5f9] rounded" />
        </div>
        <div className="h-8 w-[80px] bg-[#f1f5f9] rounded" />
        <div style={{ minHeight: '16px' }} className="w-[60px] bg-[#f1f5f9] rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl border bg-[#fef2f2] shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]"
        style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px', borderColor: '#fecaca' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fee2e2] text-[#ef4444]">
            <i className="fa-solid fa-triangle-exclamation text-lg" />
          </div>
          <span className="text-[12px] font-semibold text-[#64748b]">{label}</span>
        </div>
        <span
          className="tracking-[-0.5px] text-[#b91c1c] tabular-nums"
          style={{ fontSize: '28px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          Error
        </span>
        <div style={{ minHeight: '16px' }} className="flex items-center">
          <span className="text-[12px] font-semibold text-[#ef4444]">Failed to load</span>
        </div>
      </div>
    );
  }

  const displayValue = value === null ? '—' : formatNumber(value);
  const valueColor = value === null ? '#cbd5e1' : '#0f172a';

  return (
    <div
      className={`rounded-xl border bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] ${
        onClick
          ? 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-4px_rgba(15,23,42,0.08)]'
          : ''
      }`}
      onClick={onClick}
      style={{
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        borderColor: '#e2e8f0',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: iconBgColor }}
        >
          <span style={{ color: iconColor, fontSize: '1.1rem' }}>{icon}</span>
        </div>
        <span className="text-[12px] font-semibold tracking-[0.1px] text-[#64748b] truncate">{label}</span>
      </div>
      <span
        className="tracking-[-0.5px] tabular-nums leading-none"
        style={{
          fontSize: '28px',
          fontWeight: 800,
          color: valueColor,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {displayValue}
      </span>
      <div style={{ minHeight: '16px' }} className="flex items-center">
        {subLine ? (
          <span className="text-[12px] font-semibold truncate" style={{ color: subLineColor }}>
            {subLine}
          </span>
        ) : null}
      </div>
    </div>
  );
}