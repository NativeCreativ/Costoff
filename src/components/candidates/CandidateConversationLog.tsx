'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader } from '@/components/ui/Loader';
import { formatDateTime } from '@/lib/utils';
import {
  CANDIDATE_CONVERSATION_CHANNELS,
  CANDIDATE_CONVERSATION_CHANNEL_LABELS,
} from './candidate.schema';
import { useAddCandidateConversationMutation, useCandidateConversationsQuery } from '@/queries/candidates/useCandidateConversations';

interface CandidateConversationLogProps {
  candidateId: string;
  /** When opened from a demand's pipeline, new entries are tagged with that demand. */
  demandId?: string | null;
}

/**
 * Conversation Log: every conversation anyone had with the candidate (call, WhatsApp, email,
 * meeting), newest first. Append-only. Distinct from the Candidate Log (field changes), which
 * the demand Change Log and the candidate history already show.
 */
export function CandidateConversationLog({ candidateId, demandId }: CandidateConversationLogProps) {
  const query = useCandidateConversationsQuery(candidateId);
  const add = useAddCandidateConversationMutation(candidateId);
  const [channel, setChannel] = useState<(typeof CANDIDATE_CONVERSATION_CHANNELS)[number]>('call');
  const [content, setContent] = useState('');

  const save = () => {
    if (!content.trim()) return;
    add.mutate({ channel, content: content.trim(), demand_id: demandId ?? null }, { onSuccess: () => setContent('') });
  };

  const entries = query.data?.conversations ?? [];

  return (
    <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
      <div className="mb-3 flex items-center gap-1.5 text-[0.75rem] font-extrabold uppercase tracking-[0.05em] text-[#0f766e]">
        <MessageSquare className="h-3.5 w-3.5" /> Conversation Log ({entries.length})
      </div>

      {query.data?.can_add && (
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Conversation channel">
            {CANDIDATE_CONVERSATION_CHANNELS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={channel === value}
                onClick={() => setChannel(value)}
                className={`rounded-md border px-2.5 py-1 text-[0.75rem] font-medium ${
                  channel === value ? 'border-[#0f766e] bg-[#f0fdfa] text-[#0f766e]' : 'border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]'
                }`}
              >
                {CANDIDATE_CONVERSATION_CHANNEL_LABELS[value]}
              </button>
            ))}
          </div>
          <Textarea
            rows={2}
            value={content}
            placeholder="What was discussed? e.g. Confirmed 30 days notice, expects 14 LPA, available for L1 on Friday"
            onChange={(e) => setContent(e.target.value)}
            className="w-full resize-y rounded-md border-[#e2e8f0] px-2.5 py-1.5 text-[0.8rem] shadow-none"
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={add.isPending || !content.trim()} onClick={save}>
              {add.isPending ? 'Saving…' : 'Add to log'}
            </Button>
          </div>
        </div>
      )}

      {query.isLoading ? (
        <Loader message="Loading conversations…" size="sm" />
      ) : query.isError ? (
        <p className="text-[0.8rem] text-[#dc2626]">Couldn&apos;t load the conversation log.</p>
      ) : entries.length === 0 ? (
        <p className="text-[0.82rem] italic text-[#94a3b8]">No conversations logged yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-md border border-[#f1f5f9] bg-[#f8fafc] px-3 py-2">
              <div className="mb-0.5 flex flex-wrap items-center gap-x-2 text-[0.72rem] text-[#64748b]">
                <span className="font-semibold text-[#0f766e]">
                  {CANDIDATE_CONVERSATION_CHANNEL_LABELS[entry.channel as keyof typeof CANDIDATE_CONVERSATION_CHANNEL_LABELS] ?? entry.channel}
                </span>
                <span>{formatDateTime(entry.created_at)}</span>
                {entry.created_by_name && <span>· {entry.created_by_name}</span>}
                {entry.request_id && <span>· {entry.request_id}</span>}
              </div>
              <div className="whitespace-pre-wrap text-[0.82rem] text-[#0f172a]">{entry.content}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
