import { describe, expect, it } from 'vitest';
import { normalizeSkillsInput, matchedSkillNames, candidateMatchesSkills } from './skills';

describe('normalizeSkillsInput', () => {
  it('trims, drops blanks and de-dupes case-insensitively', () => {
    expect(normalizeSkillsInput([' React ', 'react', '', '  ', 'Node.js'])).toEqual(['React', 'Node.js']);
  });
});

describe('matchedSkillNames / candidateMatchesSkills', () => {
  const required = ['React', 'Node.js'];

  it('matches case- and whitespace-insensitively, bidirectionally', () => {
    expect(matchedSkillNames(required, [' react ', 'SQL'])).toEqual([' react ']);
    expect(matchedSkillNames(['Node'], ['Node.js'])).toEqual(['Node.js']);
    expect(candidateMatchesSkills(required, ['SQL', 'react'])).toBe(true);
  });

  it('reports no match when nothing overlaps', () => {
    expect(matchedSkillNames(required, ['SQL', 'Java'])).toEqual([]);
    expect(candidateMatchesSkills(required, ['SQL', 'Java'])).toBe(false);
  });

  it('treats an empty required-skills list as "nothing to match" (never "matches everything")', () => {
    expect(matchedSkillNames([], ['React'])).toEqual([]);
    expect(candidateMatchesSkills([], ['React'])).toBe(false);
  });

  it('handles a candidate with no skills at all', () => {
    expect(matchedSkillNames(required, undefined)).toEqual([]);
    expect(matchedSkillNames(required, null)).toEqual([]);
    expect(candidateMatchesSkills(required, [])).toBe(false);
  });
});
