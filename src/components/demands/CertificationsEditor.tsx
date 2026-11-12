'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DEMAND_CERTIFICATION_TYPES, type DemandCertification } from './demand.schema';

interface CertificationsEditorProps {
  value: DemandCertification[];
  onChange: (next: DemandCertification[]) => void;
  error?: string;
}

const TYPE_CLASSES: Record<DemandCertification['type'], string> = {
  Technical: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]',
  Behavioral: 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]',
  Others: 'bg-[#f8fafc] text-[#475569] border-[#e2e8f0]',
};

/** Demand "Certifications": name + type (Technical / Behavioral / Others), shown as chips. */
export function CertificationsEditor({ value, onChange, error }: CertificationsEditorProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DemandCertification['type']>('Technical');
  const [localError, setLocalError] = useState<string | null>(null);

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return setLocalError('Type a certification name first');
    if (value.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      return setLocalError(`"${trimmed}" is already listed`);
    }
    onChange([...value, { name: trimmed.slice(0, 150), type }]);
    setName('');
    setLocalError(null);
  };

  return (
    <div>
      <div className="mb-1 text-[0.8rem] font-semibold text-[#475569]">Certifications</div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((cert, index) => (
            <span
              key={`${cert.name}-${index}`}
              className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.75rem] font-medium', TYPE_CLASSES[cert.type])}
            >
              {cert.name}
              <span className="opacity-70">· {cert.type}</span>
              <button
                type="button"
                aria-label={`Remove ${cert.name}`}
                className="ml-0.5 opacity-60 hover:opacity-100"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          className="h-9 flex-1"
          placeholder="e.g. AWS Solutions Architect"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <select
          aria-label="Certification type"
          className="button-select h-9 w-[130px] text-[0.8rem]"
          value={type}
          onChange={(e) => setType(e.target.value as DemandCertification['type'])}
        >
          {DEMAND_CERTIFICATION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {(localError || error) && <p className="mt-1 text-[0.72rem] text-[#dc2626]">{localError || error}</p>}
    </div>
  );
}
