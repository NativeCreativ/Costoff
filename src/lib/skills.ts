export const SKILL_MAX_LENGTH = 40;

/** Case- and whitespace-insensitive identity for one skill string. */
function normalizeSkillForMatch(skill: string): string {
  return skill.trim().toLowerCase();
}

/** Same bidirectional-substring rule as `buildRawSkillOverlapWhere` (src/lib/search.ts), kept as
 *  one plain-JS implementation so client-side display (match count/names) and server-side
 *  validation can never disagree with each other — or with the raw-SQL version used for list
 *  filtering, which this mirrors term for term. */
function skillsOverlap(a: string, b: string): boolean {
  const an = normalizeSkillForMatch(a);
  const bn = normalizeSkillForMatch(b);
  if (!an || !bn) return false;
  return an.includes(bn) || bn.includes(an);
}

/** Every one of `candidateSkills` that overlaps at least one of `requiredSkills`, in the
 *  candidate's own original casing/order. Empty when `requiredSkills` is empty — a demand with
 *  no required skills has nothing to match against, so nothing is reported as "matched" (callers
 *  decide separately whether that means "show everything" or "show nothing"). */
export function matchedSkillNames(requiredSkills: readonly string[], candidateSkills: readonly string[] | null | undefined): string[] {
  const required = requiredSkills.map((s) => s.trim()).filter(Boolean);
  if (required.length === 0 || !candidateSkills) return [];
  return candidateSkills.filter((cs) => required.some((r) => skillsOverlap(cs, r)));
}

/** True when a candidate's skills overlap at least one of a demand's required skills. Also false
 *  (never true) when `requiredSkills` is empty — callers that want "no required skills means
 *  anyone qualifies" handle that case explicitly before calling this, exactly like the raw-SQL
 *  `buildRawSkillOverlapWhere` callers already do. */
export function candidateMatchesSkills(requiredSkills: readonly string[], candidateSkills: readonly string[] | null | undefined): boolean {
  return matchedSkillNames(requiredSkills, candidateSkills).length > 0;
}

/** Trims, drops empties, caps length, and dedupes case-insensitively (keeping the first
 *  occurrence's casing) — applied server-side to the Demand "Required Skills"
 *  (technology_stack) and Candidate "Key Skills" (skills) text[] columns so a client bypassing
 *  SkillsSelector can't write blank or duplicate entries. */
export function normalizeSkillsInput(skills: string[] | null | undefined): string[] {
  if (!skills || skills.length === 0) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of skills) {
    const trimmed = raw.trim().slice(0, SKILL_MAX_LENGTH);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
