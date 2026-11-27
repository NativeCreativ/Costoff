import { describe, it, expect } from 'vitest';
import { canUseModule, moduleForApiPath, moduleForPagePath, sanitizeBlockedModules } from './moduleAccess';

describe('moduleAccess', () => {
  it('a super_admin can never be restricted', () => {
    expect(canUseModule('super_admin', ['todo'], 'todo')).toBe(true);
  });

  it('other roles lose only the screens switched off', () => {
    expect(canUseModule('ta', ['todo'], 'todo')).toBe(false);
    expect(canUseModule('ta', ['todo'], 'task_log')).toBe(true);
    expect(canUseModule('ta', null, 'todo')).toBe(true);
  });

  it('maps pages and APIs by path prefix', () => {
    expect(moduleForPagePath('/reports/smart')?.key).toBe('report_smart');
    expect(moduleForPagePath('/demands/REQ-1/pipeline')?.key).toBe('demands');
    expect(moduleForPagePath('/interview-calendar')?.key).toBe('interview_calendar');
    expect(moduleForPagePath('/interviews')?.key).toBe('interviews');
    expect(moduleForApiPath('/api/todos/123')?.key).toBe('todo');
    expect(moduleForApiPath('/api/reports/todays-interviews')?.key).toBe('report_interviews_today');
    // Shared APIs are never closed by a screen switch.
    expect(moduleForApiPath('/api/demands')).toBeUndefined();
    expect(moduleForApiPath('/api/todos-other')).toBeUndefined();
  });

  it('drops unknown keys and duplicates', () => {
    expect(sanitizeBlockedModules(['todo', 'nope', 'todo', 'org_overview'])).toEqual(['org_overview', 'todo']);
  });
});
