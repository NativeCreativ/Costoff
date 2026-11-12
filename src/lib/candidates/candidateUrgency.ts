/**
 * Urgency of a candidate, from their offer in hand and notice period (client requirement: "mark
 * the urgency" using Offer_in_Hand + DOJ and Notice_Period).
 *
 *   high   — has an offer AND (its joining date is within URGENT_DOJ_DAYS, or already passed,
 *            or their notice period is short: Immediate / 15 Days). We may lose them soon.
 *   medium — has an offer, joining date further away or unknown.
 *   null   — no offer in hand.
 *
 * Kept in one place so the list badge, the candidate drawer and any later report agree.
 */
export const URGENT_DOJ_DAYS = 30;
const SHORT_NOTICE_PERIODS = ['Immediate', '15 Days'];

export interface CandidateUrgencyInput {
  offer_in_hand?: boolean | null;
  offer_doj?: string | Date | null;
  availability?: string | null;
}

export interface CandidateUrgency {
  level: 'high' | 'medium';
  label: string;
  reason: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `today` (local midnight) to the date part of `doj`. Negative = in the past. */
function daysUntil(doj: string | Date, today: Date): number | null {
  const iso = typeof doj === 'string' ? doj.slice(0, 10) : doj.toISOString().slice(0, 10);
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const target = Date.UTC(y, m - 1, d);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / DAY_MS);
}

export function candidateUrgency(c: CandidateUrgencyInput, today: Date = new Date()): CandidateUrgency | null {
  if (!c.offer_in_hand) return null;
  const days = c.offer_doj ? daysUntil(c.offer_doj, today) : null;
  const shortNotice = !!c.availability && SHORT_NOTICE_PERIODS.includes(c.availability);

  if (days !== null && days < 0) {
    return { level: 'high', label: 'Urgent', reason: `Offer joining date passed ${-days} day${days === -1 ? '' : 's'} ago` };
  }
  if (days !== null && days <= URGENT_DOJ_DAYS) {
    return { level: 'high', label: 'Urgent', reason: days === 0 ? 'Offer joining date is today' : `Offer joining date in ${days} day${days === 1 ? '' : 's'}` };
  }
  if (shortNotice) {
    return { level: 'high', label: 'Urgent', reason: `Offer in hand with ${c.availability === 'Immediate' ? 'immediate availability' : '15 days notice'}` };
  }
  return {
    level: 'medium',
    label: 'Offer in hand',
    reason: days !== null ? `Offer joining date in ${days} days` : 'Offer in hand (joining date not recorded)',
  };
}
