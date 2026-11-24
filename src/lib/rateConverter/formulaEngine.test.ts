import { describe, expect, it } from 'vitest';
import {
  evaluateExpression,
  tokenizeExpression,
  normalizeRateToBase,
  executeRateFormula,
  reverseCalculateRateFromCTC,
  DEFAULT_RATE_FORMULA,
} from './formulaEngine';

describe('Rate to CTC Formula Engine (Review Comment 2)', () => {
  describe('tokenizeExpression & evaluateExpression', () => {
    it('evaluates simple addition and subtraction', () => {
      const res = evaluateExpression('a + b - 10', { a: 100, b: 20 });
      expect(res).toBe(110);
    });

    it('evaluates multiplication and division with precedence', () => {
      const res = evaluateExpression('a + b * 2', { a: 10, b: 5 });
      expect(res).toBe(20);
    });

    it('evaluates parentheses grouping correctly', () => {
      const res = evaluateExpression('(a + b) * 2', { a: 10, b: 5 });
      expect(res).toBe(30);
    });

    it('handles "divide" keyword as division operator', () => {
      const res = evaluateExpression('d divide a', { d: 130, a: 100 });
      expect(res).toBe(1.3);
    });

    it('evaluates percentage operator (e.g. 30%)', () => {
      const res = evaluateExpression('100 * 30%', {});
      expect(res).toBe(30);
    });

    it('evaluates exact example from Review Comment 2: c = a + b, d = c + z, x = d / a, margin = 30, final value = x * (margin/100)', () => {
      const context: Record<string, number> = { a: 100, b: 20, z: 10 };
      const c = evaluateExpression('a + b', context);
      expect(c).toBe(120);
      context.c = c;

      const d = evaluateExpression('c + z', context);
      expect(d).toBe(130);
      context.d = d;

      const x = evaluateExpression('d / a', context);
      expect(x).toBe(1.3);
      context.x = x;

      context.margin = 30;

      const finalValue = evaluateExpression('x * (margin / 100)', context);
      expect(Math.round(finalValue * 1000) / 1000).toBe(0.39);
    });
  });

  describe('normalizeRateToBase', () => {
    it('normalizes hourly rate: 50/hr * 8 hrs * 22 days * 12 months', () => {
      const res = normalizeRateToBase({
        rate: 50,
        basis: 'hourly',
        hoursPerDay: 8,
        daysPerMonth: 22,
        monthsPerYear: 12,
      });
      expect(res.hourly).toBe(50);
      expect(res.weekly).toBe(50 * 8 * 5); // 2000
      expect(res.monthly).toBe(50 * 8 * 22); // 8800
      expect(res.annual).toBe(8800 * 12); // 105600
    });

    it('normalizes monthly rate: 8800/month', () => {
      const res = normalizeRateToBase({
        rate: 8800,
        basis: 'monthly',
        hoursPerDay: 8,
        daysPerMonth: 22,
        monthsPerYear: 12,
      });
      expect(res.hourly).toBe(50);
      expect(res.annual).toBe(105600);
    });

    it('normalizes weekly rate: 2000/week', () => {
      const res = normalizeRateToBase({
        rate: 2000,
        basis: 'weekly',
        hoursPerDay: 8,
        daysPerMonth: 22,
        monthsPerYear: 12,
      });
      expect(res.hourly).toBe(50);
    });
  });

  describe('executeRateFormula', () => {
    it('executes DEFAULT_RATE_FORMULA with an hourly rate of 50', () => {
      const result = executeRateFormula(DEFAULT_RATE_FORMULA, {
        rate: 50,
        rateBasis: 'hourly',
      });

      expect(result.success).toBe(true);
      expect(result.rates.hourly).toBe(50);
      expect(result.rates.annual_base).toBe(105600);
      // 105600 * 1.30 = 137280
      expect(result.rates.final_ctc).toBe(137280);
      expect(result.rates.margin_amount).toBe(31680);
      expect(result.variables.c).toBe(120);
      expect(result.variables.d).toBe(130);
      expect(result.variables.x).toBe(1.3);
    });

    it('executes with custom variable overrides and custom margin', () => {
      const config = {
        ...DEFAULT_RATE_FORMULA,
        margin_percent: 25,
      };
      const result = executeRateFormula(config, {
        rate: 100,
        rateBasis: 'hourly',
      });

      expect(result.success).toBe(true);
      // Base annual = 100 * 8 * 22 * 12 = 211200
      expect(result.rates.annual_base).toBe(211200);
      // 211200 * 1.25 = 264000
      expect(result.rates.final_ctc).toBe(264000);
    });
  });

  describe('reverseCalculateRateFromCTC', () => {
    it('accurately reverse-calculates hourly rate from CTC 137,280 with 30% margin', () => {
      const rev = reverseCalculateRateFromCTC(DEFAULT_RATE_FORMULA, 137280, 'hourly');
      expect(rev.rate).toBe(50);
      expect(rev.hourly).toBe(50);
      expect(rev.baseAnnual).toBe(105600);
      expect(rev.monthly).toBe(8800);
      expect(rev.weekly).toBe(2000);
    });

    it('reverse-calculates monthly rate when requested', () => {
      const rev = reverseCalculateRateFromCTC(DEFAULT_RATE_FORMULA, 137280, 'monthly');
      expect(rev.rate).toBe(8800);
      expect(rev.basis).toBe('monthly');
    });
  });
});
