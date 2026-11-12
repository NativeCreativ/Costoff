import { describe, it, expect } from 'vitest';
import { isAllowedListId, isAllowedListValue } from './settingsListValidation';

describe('isAllowedListId (compensation currency/type IDs)', () => {
  it('accepts an active ID on create', () => {
    expect(isAllowedListId('c1', undefined, ['c1'])).toBe(true);
  });

  it('rejects an inactive ID on create', () => {
    expect(isAllowedListId('c1', undefined, [])).toBe(false);
  });

  it('accepts an active ID on update', () => {
    expect(isAllowedListId('c2', 'c1', ['c2'])).toBe(true);
  });

  it('rejects a changed inactive ID on update', () => {
    expect(isAllowedListId('c2', 'c1', [])).toBe(false);
  });

  it('accepts an unchanged inactive ID on update (grandfather)', () => {
    expect(isAllowedListId('c2', 'c2', [])).toBe(true);
  });

  it('accepts empty / null / missing for optional fields', () => {
    expect(isAllowedListId('', 'c1', [])).toBe(true);
    expect(isAllowedListId(null, 'c1', [])).toBe(true);
    expect(isAllowedListId(undefined, 'c1', [])).toBe(true);
  });
});

describe('isAllowedListValue (experience level text)', () => {
  it('accepts an active value on create, trimmed and case-insensitive', () => {
    expect(isAllowedListValue('  Mid-Level ', undefined, ['mid-level'])).toBe(true);
  });

  it('rejects an inactive value on create', () => {
    expect(isAllowedListValue('Mid-Level', undefined, ['Junior'])).toBe(false);
  });

  it('accepts an unchanged inactive value on update', () => {
    expect(isAllowedListValue('mid-level', '  Mid-Level ', [])).toBe(true);
  });

  it('rejects a changed inactive value on update', () => {
    expect(isAllowedListValue('Senior', 'mid-level', [])).toBe(false);
  });

  it('accepts empty for optional fields', () => {
    expect(isAllowedListValue('', 'mid-level', [])).toBe(true);
  });
});
