import { describe, it, expect } from 'vitest';
import { submissionSourceForCandidate } from './candidateSource';

describe('submissionSourceForCandidate', () => {
  it('maps every candidate source to the same pipeline source (unified list)', () => {
    expect(submissionSourceForCandidate('naukri')).toBe('naukri');
    expect(submissionSourceForCandidate('linkedin')).toBe('linkedin');
    expect(submissionSourceForCandidate('referral')).toBe('referral');
    expect(submissionSourceForCandidate('others')).toBe('others');
    expect(submissionSourceForCandidate('indeed')).toBe('indeed');
    expect(submissionSourceForCandidate('direct')).toBe('direct');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(submissionSourceForCandidate('  LinkedIn ')).toBe('linkedin');
    expect(submissionSourceForCandidate('NAUKRI')).toBe('naukri');
    expect(submissionSourceForCandidate('  DiReCt ')).toBe('direct');
  });

  it('returns null when there is no source, so the caller keeps its current default', () => {
    expect(submissionSourceForCandidate(null)).toBeNull();
    expect(submissionSourceForCandidate(undefined)).toBeNull();
    expect(submissionSourceForCandidate('')).toBeNull();
    expect(submissionSourceForCandidate('   ')).toBeNull();
  });

  it('returns null for a source with no pipeline equivalent rather than guessing', () => {
    expect(submissionSourceForCandidate('some_unknown_source')).toBeNull();
  });
});