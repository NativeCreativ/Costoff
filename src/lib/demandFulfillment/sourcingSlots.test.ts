import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getResumeCapPerPosition, getResumeCapStatus } from './resumeCap';
import { nextSourcingType, promoteNextBackup, countActiveSlots } from './sourcingSlots';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    companies: {
      findUnique: vi.fn(),
    },
    super_admin_settings: {
      findUnique: vi.fn(),
    },
    demands: {
      findUnique: vi.fn(),
    },
    submissions: {
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    submission_events: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

describe('Resume Cap & Quota calculations (Review Comment 20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prioritizes company max_submissions_per_position over global settings', async () => {
    (prisma.companies.findUnique as any).mockResolvedValue({
      max_submissions_per_position: 8,
    });

    const cap = await getResumeCapPerPosition('comp-123');
    expect(cap).toBe(8);
    expect(prisma.companies.findUnique).toHaveBeenCalledWith({
      where: { id: 'comp-123' },
      select: { max_submissions_per_position: true },
    });
    // super_admin_settings should not even be queried when company override is present
    expect(prisma.super_admin_settings.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to super_admin_settings when company has no max_submissions_per_position', async () => {
    (prisma.companies.findUnique as any).mockResolvedValue({
      max_submissions_per_position: null,
    });
    (prisma.super_admin_settings.findUnique as any).mockResolvedValue({
      value: 6,
    });

    const cap = await getResumeCapPerPosition('comp-123');
    expect(cap).toBe(6);
  });

  it('falls back to default 5 when neither company nor super_admin_settings provides a value', async () => {
    (prisma.companies.findUnique as any).mockResolvedValue(null);
    (prisma.super_admin_settings.findUnique as any).mockResolvedValue(null);

    const cap = await getResumeCapPerPosition('comp-123');
    expect(cap).toBe(5);
  });

  it('calculates total cap as numPositions × capPerPosition and counts only active submissions', async () => {
    (prisma.companies.findUnique as any).mockResolvedValue({ max_submissions_per_position: 4 });
    (prisma.submissions.count as any).mockResolvedValue(7);

    const status = await getResumeCapStatus('dem-1', 2, 'comp-1');
    expect(status.cap).toBe(8); // 2 positions * 4 = 8
    expect(status.current).toBe(7);
    expect(status.reached).toBe(false);
  });
});

describe('nextSourcingType and Backup Auto-Promotion (Review Comment 20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns active when active slots < cap, and backup when active slots >= cap', async () => {
    (prisma.companies.findUnique as any).mockResolvedValue({ max_submissions_per_position: 3 });

    const mockDb = {
      submissions: {
        count: vi.fn(),
      },
    } as any;

    // 1 position * 3 = 3 cap. Currently 2 active slots -> next is active
    mockDb.submissions.count.mockResolvedValue(2);
    const type1 = await nextSourcingType(mockDb, 'dem-1', 1, 'comp-1');
    expect(type1).toBe('active');

    // Currently 3 active slots -> next is backup
    mockDb.submissions.count.mockResolvedValue(3);
    const type2 = await nextSourcingType(mockDb, 'dem-1', 1, 'comp-1');
    expect(type2).toBe('backup');
  });

  it('promotes the earliest submitted backup profile to active and logs status_change event', async () => {
    const mockDb = {
      submissions: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'sub-backup-earliest',
          current_status: 'sourced',
        }),
        update: vi.fn().mockResolvedValue({ id: 'sub-backup-earliest', sourcing_type: 'active' }),
      },
      submission_events: {
        create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
      },
    } as any;

    const promotedId = await promoteNextBackup(mockDb, 'dem-1', 'user-am');
    expect(promotedId).toBe('sub-backup-earliest');

    expect(mockDb.submissions.findFirst).toHaveBeenCalledWith({
      where: { demand_id: 'dem-1', is_active: true, sourcing_type: 'backup' },
      orderBy: { created_at: 'asc' },
      select: { id: true, current_status: true },
    });

    expect(mockDb.submissions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-backup-earliest' },
        data: expect.objectContaining({ sourcing_type: 'active' }),
      })
    );

    expect(mockDb.submission_events.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        submission_id: 'sub-backup-earliest',
        event_type: 'status_change',
        content: 'Automatically promoted from Backup to Active in submission order after position slot opened',
        created_by: 'user-am',
      }),
    });
  });

  it('does nothing when no backup candidate exists', async () => {
    const mockDb = {
      submissions: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      submission_events: {
        create: vi.fn(),
      },
    } as any;

    const promotedId = await promoteNextBackup(mockDb, 'dem-1', 'user-am');
    expect(promotedId).toBeNull();
    expect(mockDb.submissions.update).not.toHaveBeenCalled();
    expect(mockDb.submission_events.create).not.toHaveBeenCalled();
  });
});
