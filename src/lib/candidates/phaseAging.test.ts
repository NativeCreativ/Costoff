import { describe, expect, it } from 'vitest';
import { computePhaseAging } from './phaseAging';

const now = new Date('2026-11-20T10:00:00Z');

describe('candidate phase aging', () => {
  it('counts days from entering a phase, e.g. 7 days waiting for the customer shortlist', () => {
    const aging = computePhaseAging({
      created_at: '2026-11-01T10:00:00Z',
      current_status: 'customer_shortlisted',
      events: [
        { to_status: 'submitted_to_spoc', created_at: '2026-11-02T10:00:00Z' },
        { to_status: 'shortlisted_internal', created_at: '2026-11-03T10:00:00Z' },
        { to_status: 'sent_to_customer', created_at: '2026-11-04T10:00:00Z' },
        { to_status: 'customer_shortlisted', created_at: '2026-11-10T10:00:00Z' },
      ],
    }, now);
    expect(aging.days_by_phase.sourcing).toBe(2);
    expect(aging.days_by_phase.shortlist).toBe(7);
    expect(aging.current_phase).toBe('selection');
    expect(aging.days_in_current_phase).toBe(10);
  });

  it('a status change inside a phase does not restart the clock', () => {
    const aging = computePhaseAging({
      created_at: '2026-11-15T10:00:00Z',
      current_status: 'submitted_to_spoc',
      events: [{ to_status: 'submitted_to_spoc', created_at: '2026-11-17T10:00:00Z' }],
    }, now);
    expect(aging.current_phase).toBe('sourcing');
    expect(aging.days_in_current_phase).toBe(5);
  });

  it('stops counting once the candidate leaves the pipeline', () => {
    const aging = computePhaseAging({
      created_at: '2026-11-01T10:00:00Z',
      current_status: 'rejected',
      events: [{ to_status: 'rejected', created_at: '2026-11-05T10:00:00Z' }],
    }, now);
    expect(aging.current_phase).toBeNull();
    expect(aging.days_in_current_phase).toBeNull();
    expect(aging.days_by_phase.sourcing).toBe(4);
  });
});
