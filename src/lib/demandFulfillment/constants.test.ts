import { describe, it, expect } from 'vitest';
import { normalizeOnboardingChecklist } from './constants';

describe('normalizeOnboardingChecklist', () => {
  it('marks items without isActive as active', () => {
    const out = normalizeOnboardingChecklist([{ name: 'Resume', required: true }]);
    expect(out).toEqual([{ name: 'Resume', required: true, isActive: true }]);
  });

  it('keeps an explicit isActive flag', () => {
    const out = normalizeOnboardingChecklist([{ name: 'Resume', required: false, isActive: false }]);
    expect(out[0].isActive).toBe(false);
  });

  it('drops blank names', () => {
    expect(normalizeOnboardingChecklist([{ name: '   ', required: true }])).toEqual([]);
  });
});
