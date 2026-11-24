import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getSimilarDemandsForCandidate } from './similarDemands';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    candidates: {
      findUnique: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';

describe('Similar Demands Suggestion Engine (Review Comment 22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when candidate has no skills', async () => {
    (prisma.candidates.findUnique as any).mockResolvedValue({
      id: 'cand-1',
      skills: [],
    });

    const suggestions = await getSimilarDemandsForCandidate('cand-1', 'dem-curr');
    expect(suggestions).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('matches demands by technology stack overlap and orders by match count', async () => {
    (prisma.candidates.findUnique as any).mockResolvedValue({
      id: 'cand-1',
      skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    });

    (prisma.$queryRaw as any).mockResolvedValue([
      {
        id: 'dem-1',
        request_id: 'REQ-001',
        job_title: 'Fullstack Dev',
        status: 'Open',
        num_positions: 2,
        technology_stack: ['React', 'TypeScript', 'Node.js'],
        client_name: 'Acme Corp',
      },
      {
        id: 'dem-2',
        request_id: 'REQ-002',
        job_title: 'Backend Engineer',
        status: 'Sourcing',
        num_positions: 1,
        technology_stack: ['Python', 'Django'],
        client_name: 'Beta LLC',
      },
      {
        id: 'dem-3',
        request_id: 'REQ-003',
        job_title: 'Frontend Lead',
        status: 'Shortlist',
        num_positions: 3,
        technology_stack: ['React'],
        client_name: 'Gamma Tech',
      },
    ]);

    const suggestions = await getSimilarDemandsForCandidate('cand-1', 'dem-curr', 5);

    // dem-2 has 0 matches so it should be filtered out
    expect(suggestions.length).toBe(2);

    // dem-1 has 3 matches (React, TypeScript, Node.js), dem-3 has 1 match (React)
    expect(suggestions[0].request_id).toBe('REQ-001');
    expect(suggestions[0].match_count).toBe(3);
    expect(suggestions[0].matching_skills).toEqual(['React', 'TypeScript', 'Node.js']);

    expect(suggestions[1].request_id).toBe('REQ-003');
    expect(suggestions[1].match_count).toBe(1);
    expect(suggestions[1].matching_skills).toEqual(['React']);
  });
});
