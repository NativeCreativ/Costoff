import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { canManageSkillsLibrary } from '@/lib/auth/demandFulfillmentPermissions';
import { skillRenameSchema } from '@/components/settings/skillsLibrary.schema';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    const parsed = skillRenameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.skills.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    if (!parsed.data.name && !parsed.data.skill_type && parsed.data.classification_id === undefined && !parsed.data.category_id) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const nextCategoryId = parsed.data.category_id ?? existing.category_id;
    const nextName = parsed.data.name ?? existing.name;
    if (parsed.data.category_id) {
      const category = await prisma.skill_categories.findUnique({ where: { id: parsed.data.category_id } });
      if (!category) return NextResponse.json({ error: 'Skill group not found' }, { status: 404 });
    }
    if (parsed.data.classification_id) {
      const classification = await prisma.skill_classifications.findUnique({ where: { id: parsed.data.classification_id } });
      if (!classification || !classification.is_active) {
        return NextResponse.json({ error: 'Skill category was not found or is inactive' }, { status: 400 });
      }
    }

    const nameOwner = await prisma.skills.findFirst({
      where: { category_id: nextCategoryId, name: { equals: nextName, mode: 'insensitive' } },
    });
    if (nameOwner && nameOwner.id !== id) {
      return NextResponse.json({ error: `"${nextName}" is already in this skill group` }, { status: 409 });
    }

    const demands = await prisma.demands.findMany({ select: { technology_stack: true } });
    const candidateRows = await prisma.candidates.findMany({ select: { skills: true } });
    const norm = existing.name.trim().toLowerCase();
    const demandCount = demands.filter((d) => d.technology_stack.some((s) => s.trim().toLowerCase() === norm)).length;
    const candidateCount = candidateRows.filter((c) => c.skills.some((s) => s.trim().toLowerCase() === norm)).length;
    const parts = [];
    if (demandCount) parts.push(`${demandCount} demands`);
    if (candidateCount) parts.push(`${candidateCount} candidates`);
    const usageTotal = demandCount + candidateCount;
    const nameChanging = nextName.trim().toLowerCase() !== existing.name.trim().toLowerCase();
    if (usageTotal > 0 && nameChanging) {
      return NextResponse.json(
        { error: `"${existing.name}" is in use (${parts.join(', ')}) and cannot be edited or deleted.` },
        { status: 409 }
      );
    }

    const skill = await prisma.skills.update({
      where: { id },
      data: {
        name: nextName,
        category_id: nextCategoryId,
        ...(parsed.data.skill_type ? { skill_type: parsed.data.skill_type } : {}),
        ...(parsed.data.classification_id !== undefined
          ? { classification_id: parsed.data.classification_id || null }
          : {}),
      },
    });
    return NextResponse.json({ skill, success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PUT /api/admin/settings/skills/[id]:', error);
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 });
  }
}

// DELETE — hard delete. No in-use block: demands/candidates store plain text skills, no FK here.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (!canManageSkillsLibrary(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;

    const existing = await prisma.skills.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const demands = await prisma.demands.findMany({ select: { technology_stack: true } });
    const candidateRows = await prisma.candidates.findMany({ select: { skills: true } });
    const norm = existing.name.trim().toLowerCase();
    const demandCount = demands.filter((d) => d.technology_stack.some((s) => s.trim().toLowerCase() === norm)).length;
    const candidateCount = candidateRows.filter((c) => c.skills.some((s) => s.trim().toLowerCase() === norm)).length;
    const usageTotal = demandCount + candidateCount;
    if (usageTotal > 0) {
      const parts = [];
      if (demandCount) parts.push(`${demandCount} demands`);
      if (candidateCount) parts.push(`${candidateCount} candidates`);
      return NextResponse.json(
        { error: `"${existing.name}" is in use (${parts.join(', ')}) and cannot be edited or deleted.` },
        { status: 409 }
      );
    }
    await prisma.skills.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/admin/settings/skills/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete skill' }, { status: 500 });
  }
}
