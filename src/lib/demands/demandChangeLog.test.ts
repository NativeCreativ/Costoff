import { describe, expect, it } from 'vitest';
import {
  assignmentEventRows,
  candidateChangeSnapshot,
  demandChangeSnapshot,
  diffFields,
  pickSent,
  sentChangeFields,
  toChangeLogText,
} from './demandChangeLog';

describe('toChangeLogText', () => {
  it('treats blank, null and empty arrays as no value', () => {
    expect(toChangeLogText('')).toBeNull();
    expect(toChangeLogText('   ')).toBeNull();
    expect(toChangeLogText(null)).toBeNull();
    expect(toChangeLogText([])).toBeNull();
  });

  it('joins arrays and clips very long text', () => {
    expect(toChangeLogText(['Remote', ' Hybrid '])).toBe('Remote, Hybrid');
    expect(toChangeLogText('x'.repeat(2500))?.length).toBe(2001);
  });
});

describe('diffFields', () => {
  it('reports only fields that really changed', () => {
    const changes = diffFields(
      { job_title: 'Dev', locations: ['Pune'], priority: 'High', customer_jd: null },
      { job_title: 'Senior Dev', locations: ['Pune'], priority: 'High', customer_jd: '' }
    );
    expect(changes).toEqual([{ field: 'job_title', old_value: 'Dev', new_value: 'Senior Dev' }]);
  });

  it('ignores fields the edit did not send', () => {
    expect(diffFields({ job_title: 'Dev', priority: 'High' }, { priority: 'Low' })).toEqual([
      { field: 'priority', old_value: 'High', new_value: 'Low' },
    ]);
  });
});

describe('demand change snapshot', () => {
  it('uses names for related records and falls back to the legacy work mode', () => {
    const snap = demandChangeSnapshot({
      work_mode: 'Hybrid',
      work_modes: [],
      end_clients: { name: 'Acme' },
      compensation_currencies: { code: 'INR' },
    });
    expect(snap.work_modes).toEqual(['Hybrid']);
    expect(snap.end_client).toBe('Acme');
    expect(snap.compensation_currency).toBe('INR');
  });

  it('maps sent body keys to snapshot fields', () => {
    const fields = sentChangeFields(
      { job_title: 'x', end_client_id: null, work_modes: ['Remote'], customer_jd_file_url: '' },
      (key) => key === 'locations'
    );
    expect(fields.sort()).toEqual(['customer_jd_file_name', 'end_client', 'job_title', 'locations', 'work_modes'].sort());
  });

  it('logs a work mode change from one mode to two', () => {
    const before = demandChangeSnapshot({ work_mode: 'Remote', work_modes: ['Remote'] });
    const after = pickSent(demandChangeSnapshot({ work_mode: 'Remote', work_modes: ['Remote', 'Hybrid'] }), ['work_modes']);
    expect(diffFields(before, after)).toEqual([{ field: 'work_modes', old_value: 'Remote', new_value: 'Remote, Hybrid' }]);
  });
});

describe('candidateChangeSnapshot', () => {
  it('formats dates and decimals', () => {
    const snap = candidateChangeSnapshot({
      available_from: new Date('2026-12-01T00:00:00Z'),
      current_ctc: { toString: () => '1200000' },
      full_name: 'Asha',
    });
    expect(snap.available_from).toBe('2026-12-01');
    expect(snap.current_ctc).toBe('1200000');
    expect(snap.full_name).toBe('Asha');
  });
});

describe('assignmentEventRows', () => {
  it('emits assign and unassign rows for the difference only', () => {
    const rows = assignmentEventRows({ demandId: 'd', category: 'recruiter', previousIds: ['a', 'b'], nextIds: ['b', 'c', null], actorId: 'u' });
    expect(rows.map((r) => `${r.action}:${r.subject_id}`).sort()).toEqual(['assign:c', 'unassign:a']);
  });

  it('emits nothing when unchanged', () => {
    expect(assignmentEventRows({ demandId: 'd', category: 'costaff_spoc', previousIds: ['a'], nextIds: ['a'], actorId: 'u' })).toEqual([]);
  });
});
