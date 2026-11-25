'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { askSmartReport } from '@/services/report.service';

const EXAMPLES = [
  'Which demands have been open the longest, and why might they be stuck?',
  'How many interviews do we have this week, day by day?',
  'Where are candidates waiting longest in the pipeline?',
  'Give me a one-paragraph summary of all active demands by client.',
  'Which demands have no candidates yet?',
];

/** Minimal markdown for the answer: headings, bullets, bold and simple tables. No HTML is injected. */
function renderAnswer(text: string): ReactNode[] {
  const bold = (line: string, key: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong> : part
    );
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      out.push(
        <div key={`t${i}`} className="table-scroll my-2">
          <table className="w-full text-left text-[0.8rem]">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri === 0 ? 'border-b border-[#e2e8f0] font-semibold text-[#475569]' : 'border-b border-[#f1f5f9]'}>
                  {r.map((c, ci) => <td key={ci} className="px-2 py-1">{bold(c, `c${ri}${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else if (/^#{1,4}\s/.test(line)) {
      out.push(<div key={i} className="mt-3 text-[0.9rem] font-bold text-[#0f172a]">{bold(line.replace(/^#+\s/, ''), `h${i}`)}</div>);
    } else if (/^\s*[-*]\s/.test(line)) {
      out.push(<div key={i} className="ml-4 list-item list-disc text-[0.85rem]">{bold(line.replace(/^\s*[-*]\s/, ''), `b${i}`)}</div>);
    } else if (line.trim() === '') {
      out.push(<div key={i} className="h-2" />);
    } else {
      out.push(<p key={i} className="text-[0.85rem]">{bold(line, `p${i}`)}</p>);
    }
  }
  return out;
}

/**
 * Smart Reports (review of 18 Nov 2026, item 12): ask a question in plain English and get an
 * answer built from the recruitment data you can see. Powered by Claude; candidate names and
 * contact details are never sent to it.
 */
export function SmartReportView() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const ask = async (q: string) => {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setAnswer('');
    setAsked(text);
    try {
      await askSmartReport(text, (chunk) => setAnswer((prev) => prev + chunk), controller.signal);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Smart Reports could not answer right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Textarea
          rows={2}
          value={question}
          maxLength={1000}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(question); }
          }}
          placeholder="Ask about your demands, pipeline, interviews or team, e.g. “Which demands are at risk this week?”"
          className="w-full resize-y rounded-md border-[#e2e8f0] px-3 py-2 text-[0.85rem] shadow-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="gap-1.5" disabled={busy || question.trim().length < 3} onClick={() => ask(question)}>
            <Sparkles className="h-4 w-4" /> {busy ? 'Thinking…' : 'Ask'}
          </Button>
          <span className="text-[0.72rem] text-[#94a3b8]">Uses only data you can see. Candidate names and contact details are never sent.</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => { setQuestion(q); ask(q); }}
              className="rounded-full border border-[#e2e8f0] px-2.5 py-1 text-left text-[0.74rem] text-[#475569] hover:bg-[#f8fafc] disabled:opacity-60"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-[0.8rem] text-[#b91c1c]">{error}</div>}

      {(answer || busy) && (
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-4 text-[#334155]" aria-live="polite">
          <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">{asked}</div>
          {answer ? renderAnswer(answer) : <p className="text-[0.85rem] text-[#94a3b8]">Reading your data…</p>}
        </div>
      )}
      <p className="text-[0.72rem] text-[#94a3b8]">AI answers can be wrong. Check important numbers in the regular reports.</p>
    </div>
  );
}
