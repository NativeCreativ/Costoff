import { describe, expect, it } from 'vitest';
import { candidateUrgency } from './candidateUrgency';
import { demandSchema, toDemandCertifications } from '@/components/demands/demand.schema';
import { candidateConversationSchema } from '@/components/candidates/candidate.schema';
import { canLogCandidateConversation } from '@/lib/auth/candidatePermissions';

const today = new Date(2026, 10, 13); // 13 Nov 2026, local

describe('candidateUrgency', () => {
  it('is null without an offer in hand', () => {
    expect(candidateUrgency({ offer_in_hand: false, offer_doj: '2026-11-20', availability: 'Immediate' }, today)).toBeNull();
  });

  it('is urgent when the offer joins within 30 days', () => {
    expect(candidateUrgency({ offer_in_hand: true, offer_doj: '2026-11-20' }, today)).toMatchObject({ level: 'high', reason: 'Offer joining date in 7 days' });
    expect(candidateUrgency({ offer_in_hand: true, offer_doj: '2026-11-13' }, today)?.reason).toBe('Offer joining date is today');
  });

  it('is urgent when the joining date has passed', () => {
    expect(candidateUrgency({ offer_in_hand: true, offer_doj: '2026-11-10' }, today)).toMatchObject({ level: 'high' });
  });

  it('is urgent with an offer and a short notice period', () => {
    expect(candidateUrgency({ offer_in_hand: true, offer_doj: null, availability: '0-15 Days' }, today)?.level).toBe('high');
  });

  it('is medium for a far-off or unknown joining date', () => {
    expect(candidateUrgency({ offer_in_hand: true, offer_doj: '2027-02-01', availability: '60 Days' }, today)?.level).toBe('medium');
    expect(candidateUrgency({ offer_in_hand: true, availability: '30 Days' }, today)?.label).toBe('Offer in hand');
  });
});

describe('demand certifications', () => {
  it('reads stored JSON defensively', () => {
    expect(toDemandCertifications([{ name: 'AWS SA', type: 'Technical' }, { name: '', type: 'Technical' }, 'junk', null])).toEqual([
      { name: 'AWS SA', type: 'Technical' },
    ]);
    expect(toDemandCertifications(null)).toEqual([]);
  });

  it('rejects duplicates and unknown types in the form schema', () => {
    const cert = demandSchema.shape.certifications;
    expect(cert.safeParse([{ name: 'PMP', type: 'Others' }, { name: 'pmp', type: 'Others' }]).success).toBe(false);
    expect(cert.safeParse([{ name: 'PMP', type: 'Managerial' }]).success).toBe(false);
    expect(cert.safeParse([{ name: 'PMP', type: 'Behavioral' }]).success).toBe(true);
  });
});

describe('conversation log', () => {
  it('requires a channel and some text', () => {
    expect(candidateConversationSchema.safeParse({ channel: 'call', content: '  ' }).success).toBe(false);
    expect(candidateConversationSchema.safeParse({ channel: 'fax', content: 'hi' }).success).toBe(false);
    expect(candidateConversationSchema.safeParse({ channel: 'whatsapp', content: 'Confirmed notice' }).success).toBe(true);
  });

  it('lets write roles log on a candidate they can see, never viewers', () => {
    const ctx = { demands: [{ demand_id: 'd', created_by: 'am1', contact_profile_id: 'am1', spoc_profile_id: null, recruiter_ids: ['ta2'], adders: [] }] };
    expect(canLogCandidateConversation({ role: 'ta', id: 'ta1' }, ctx)).toBe(true);
    expect(canLogCandidateConversation({ role: 'account_manager', id: 'am1' }, ctx)).toBe(true);
    expect(canLogCandidateConversation({ role: 'account_manager', id: 'am2' }, ctx)).toBe(false);
    expect(canLogCandidateConversation({ role: 'viewer', id: 'v' }, ctx)).toBe(false);
  });
});
