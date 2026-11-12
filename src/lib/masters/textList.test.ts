import { describe, expect, it } from 'vitest';
import { firstDisallowedText, isKnownOrCurrent } from './textList';

describe('master text lists', () => {
  it('accepts an active name regardless of case', () => {
    expect(isKnownOrCurrent('bangalore', [], ['Bangalore'])).toBe(true);
  });

  it('grandfathers a saved value that is no longer active', () => {
    expect(isKnownOrCurrent('Pune', ['Pune'], ['Bangalore'])).toBe(true);
    expect(firstDisallowedText(['Pune', 'Bangalore'], ['Pune'], ['Bangalore'])).toBeNull();
  });

  it('rejects a new value that is not in the master', () => {
    expect(firstDisallowedText(['Mumbai'], [], ['Bangalore', 'Chennai'])).toBe('Mumbai');
  });

  it('does not reject when the master has not been seeded', () => {
    expect(firstDisallowedText(['Anywhere'], [], [])).toBeNull();
  });
});
