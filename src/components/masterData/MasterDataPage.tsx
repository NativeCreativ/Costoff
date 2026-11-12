import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Title + description + white card. `wide` drops the 5xl cap for wide tables (reports). */
export function MasterDataPage({ title, description, children, wide }: { title: string; description: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('mx-auto flex flex-col gap-4', wide ? 'w-full max-w-[1400px]' : 'max-w-5xl')}>
      <div>
        <h1 className="text-[1.25rem] font-bold tracking-[-0.2px] text-[#0f172a]">{title}</h1>
        <p className="mt-1 text-[0.85rem] leading-relaxed text-[#64748b]">{description}</p>
      </div>
      <div className="rounded-xl border border-[color:var(--card-border)] bg-white p-4 shadow-[var(--card-shadow)]">
        {children}
      </div>
    </div>
  );
}
