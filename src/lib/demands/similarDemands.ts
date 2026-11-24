import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/prisma';

export interface SimilarDemandSuggestion {
  id: string;
  request_id: string;
  job_title: string;
  client_name: string | null;
  status: string;
  num_positions: number;
  technology_stack: string[];
  matching_skills: string[];
  match_count: number;
}

/**
 * Recommends active demands in the database whose technology stack overlaps with a candidate's skills,
 * excluding demands where the candidate is already attached (Review Comment 22).
 */
export async function getSimilarDemandsForCandidate(
  candidateId: string,
  excludeDemandId?: string | null,
  limit: number = 5
): Promise<SimilarDemandSuggestion[]> {
  const candidate = await prisma.candidates.findUnique({
    where: { id: candidateId },
    select: { id: true, skills: true },
  });

  if (!candidate || !candidate.skills || candidate.skills.length === 0) {
    return [];
  }

  const candidateSkills = candidate.skills.map((s) => s.trim().toLowerCase());

  const conditions: Prisma.Sql[] = [
    Prisma.sql`COALESCE(d.status, '') NOT IN ('Closure', 'Cancelled')`,
    Prisma.sql`NOT EXISTS (SELECT 1 FROM submissions s WHERE s.demand_id = d.id AND s.candidate_id = ${candidateId}::uuid)`,
  ];

  if (excludeDemandId) {
    conditions.push(Prisma.sql`d.id != ${excludeDemandId}::uuid`);
  }

  const rows = await prisma.$queryRaw<
    {
      id: string;
      request_id: string;
      job_title: string | null;
      skill_description: string | null;
      status: string | null;
      num_positions: number | null;
      technology_stack: string[] | null;
      client_name: string | null;
    }[]
  >`
    SELECT d.id, d.request_id, d.job_title, d.skill_description, d.status,
           COALESCE(d.num_positions, 1) AS num_positions,
           d.technology_stack,
           COALESCE(co.client_name, co.name, d.client_name) AS client_name
    FROM demands d
    LEFT JOIN companies co ON co.id = d.company_id
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;

  return rows
    .map((d) => {
      const demandTech = (d.technology_stack || []).map((s) => s.trim());
      const matchingSkills = demandTech.filter((s) => candidateSkills.includes(s.toLowerCase()));
      return {
        id: d.id,
        request_id: d.request_id,
        job_title: d.job_title || d.skill_description || 'Demand Requirement',
        client_name: d.client_name ?? null,
        status: d.status || 'Open',
        num_positions: d.num_positions ?? 1,
        technology_stack: demandTech,
        matching_skills: matchingSkills,
        match_count: matchingSkills.length,
      };
    })
    .filter((d) => d.match_count > 0)
    .sort((a, b) => b.match_count - a.match_count)
    .slice(0, limit);
}
