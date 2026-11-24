/**
 * formulaEngine.ts
 *
 * Safe, deterministic formula evaluation and Rate <-> CTC conversion engine.
 * Supports standard mathematical operations: +, -, *, /, divide, %
 *
 * Handles:
 * 1. Step-by-step formula execution (e.g. c = a + b, d = c + z, x = d / a, margin = 30, final_value = x * (margin/100))
 * 2. Rate to CTC conversion (Hourly / Weekly / Monthly -> Annual CTC)
 * 3. Bidirectional CTC to Rate conversion (Annual CTC -> Hourly / Weekly / Monthly)
 * 4. Client-level configuration with Demand-level copying and customization
 */

export type RateBasis = 'hourly' | 'weekly' | 'monthly';

export interface FormulaStep {
  id: string;
  variable: string;
  expression: string;
  description?: string;
}

export interface RateFormulaConfig {
  name?: string;
  description?: string;
  base_rate_type: RateBasis;
  working_hours_per_day: number;
  working_days_per_month: number;
  months_per_year: number;
  margin_percent: number;
  custom_variables: Record<string, number>;
  steps: FormulaStep[];
  final_variable: string;
}

export interface StepEvaluationDetail {
  id: string;
  variable: string;
  expression: string;
  value: number;
  error?: string;
}

export interface FormulaEvaluationResult {
  success: boolean;
  finalValue: number;
  variables: Record<string, number>;
  stepDetails: StepEvaluationDetail[];
  error?: string;
  // Standardized projections
  rates: {
    hourly: number;
    weekly: number;
    monthly: number;
    annual_base: number;
    final_ctc: number;
    margin_amount: number;
  };
}

/**
 * Standard default formula config matching Review Comment 2:
 * c = a + b, d = c + z, x = d / a, margin = 30, final_value = x * (margin / 100)
 */
export const DEFAULT_RATE_FORMULA: RateFormulaConfig = {
  name: 'Standard Rate to CTC Formula',
  description: 'Calculates contractor CTC including standard markup and overheads',
  base_rate_type: 'hourly',
  working_hours_per_day: 8,
  working_days_per_month: 22,
  months_per_year: 12,
  margin_percent: 30,
  custom_variables: {
    a: 100,
    b: 20,
    z: 10,
  },
  steps: [
    { id: 'step_1', variable: 'c', expression: 'a + b', description: 'Base plus overhead' },
    { id: 'step_2', variable: 'd', expression: 'c + z', description: 'Total loaded cost' },
    { id: 'step_3', variable: 'x', expression: 'd / a', description: 'Loading factor' },
    { id: 'step_4', variable: 'margin', expression: 'margin_percent', description: 'Margin percentage' },
    { id: 'step_5', variable: 'markup_multiplier', expression: '1 + (margin / 100)', description: 'Total markup multiplier' },
    { id: 'step_6', variable: 'final_ctc', expression: 'annual_base * markup_multiplier', description: 'Final CTC including margin' },
  ],
  final_variable: 'final_ctc',
};

// ── Safe Expression Tokenizer & Evaluator ─────────────────────────────────────

type TokenType = 'NUMBER' | 'IDENTIFIER' | 'OPERATOR' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value: string;
}

export function tokenizeExpression(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const str = expr.trim();

  while (i < str.length) {
    const char = str[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Numbers (integer or float)
    if (/[0-9]/.test(char) || (char === '.' && i + 1 < str.length && /[0-9]/.test(str[i + 1]))) {
      let numStr = '';
      while (i < str.length && /[0-9.]/.test(str[i])) {
        numStr += str[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    // % as postfix percentage operator (e.g. 30% -> / 100)
    if (char === '%') {
      tokens.push({ type: 'OPERATOR', value: '%' });
      i++;
      continue;
    }

    // Operators +, -, *, /, divide
    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }

    // Identifiers (variable names or keyword 'divide')
    if (/[a-zA-Z_]/.test(char)) {
      let ident = '';
      while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) {
        ident += str[i];
        i++;
      }
      if (ident.toLowerCase() === 'divide') {
        tokens.push({ type: 'OPERATOR', value: '/' });
      } else {
        tokens.push({ type: 'IDENTIFIER', value: ident });
      }
      continue;
    }

    // Unknown character, skip
    i++;
  }

  return tokens;
}

/**
 * Evaluates an infix arithmetic expression using Shunting-yard algorithm and RPN evaluation.
 * Does not use eval() or Function().
 */
export function evaluateExpression(expr: string, context: Record<string, number>): number {
  const tokens = tokenizeExpression(expr);
  if (tokens.length === 0) return 0;

  // Convert to Reverse Polish Notation (RPN)
  const outputQueue: Token[] = [];
  const opStack: Token[] = [];

  const precedence: Record<string, number> = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
    '%': 3, // postfix percentage
  };

  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx];

    if (token.type === 'NUMBER') {
      outputQueue.push(token);
    } else if (token.type === 'IDENTIFIER') {
      const val = context[token.value] ?? context[token.value.toLowerCase()] ?? 0;
      outputQueue.push({ type: 'NUMBER', value: String(val) });
    } else if (token.type === 'OPERATOR') {
      if (token.value === '%') {
        // Postfix percentage: immediately divide top number by 100
        outputQueue.push({ type: 'OPERATOR', value: '%' });
      } else {
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1].type === 'OPERATOR' &&
          (precedence[opStack[opStack.length - 1].value] || 0) >= (precedence[token.value] || 0)
        ) {
          outputQueue.push(opStack.pop()!);
        }
        opStack.push(token);
      }
    } else if (token.type === 'LPAREN') {
      opStack.push(token);
    } else if (token.type === 'RPAREN') {
      while (opStack.length > 0 && opStack[opStack.length - 1].type !== 'LPAREN') {
        outputQueue.push(opStack.pop()!);
      }
      if (opStack.length > 0 && opStack[opStack.length - 1].type === 'LPAREN') {
        opStack.pop();
      }
    }
  }

  while (opStack.length > 0) {
    const op = opStack.pop()!;
    if (op.type !== 'LPAREN' && op.type !== 'RPAREN') {
      outputQueue.push(op);
    }
  }

  // Evaluate RPN
  const evalStack: number[] = [];

  for (const token of outputQueue) {
    if (token.type === 'NUMBER') {
      evalStack.push(parseFloat(token.value));
    } else if (token.type === 'OPERATOR') {
      if (token.value === '%') {
        const val = evalStack.pop() ?? 0;
        evalStack.push(val / 100);
      } else {
        const b = evalStack.pop() ?? 0;
        const a = evalStack.pop() ?? 0;
        switch (token.value) {
          case '+':
            evalStack.push(a + b);
            break;
          case '-':
            evalStack.push(a - b);
            break;
          case '*':
            evalStack.push(a * b);
            break;
          case '/':
            evalStack.push(b === 0 ? 0 : a / b);
            break;
          default:
            evalStack.push(0);
        }
      }
    }
  }

  return evalStack.length > 0 ? evalStack[0] : 0;
}

// ── Rate to CTC & Bidirectional Calculations ─────────────────────────────────

export interface RateInput {
  rate: number;
  basis: RateBasis;
  hoursPerDay?: number;
  daysPerMonth?: number;
  monthsPerYear?: number;
}

/**
 * Normalizes any rate basis (hourly, weekly, monthly) to baseline amounts.
 */
export function normalizeRateToBase(input: RateInput): {
  hourly: number;
  weekly: number;
  monthly: number;
  annual: number;
} {
  const hours = input.hoursPerDay || 8;
  const days = input.daysPerMonth || 22;
  const months = input.monthsPerYear || 12;

  let hourly = 0;
  if (input.basis === 'hourly') {
    hourly = input.rate;
  } else if (input.basis === 'weekly') {
    hourly = input.rate / (hours * 5);
  } else if (input.basis === 'monthly') {
    hourly = input.rate / (days * hours);
  }

  const daily = hourly * hours;
  const weekly = daily * 5;
  const monthly = daily * days;
  const annual = monthly * months;

  return { hourly, weekly, monthly, annual };
}

/**
 * Full execution of the RateFormulaConfig with input values.
 */
export function executeRateFormula(
  config: RateFormulaConfig,
  input: {
    rate?: number;
    rateBasis?: RateBasis;
    ctc?: number;
    variableOverrides?: Record<string, number>;
  }
): FormulaEvaluationResult {
  const hours = config.working_hours_per_day || 8;
  const days = config.working_days_per_month || 22;
  const months = config.months_per_year || 12;
  const margin = config.margin_percent ?? 30;

  // Determine baseline rate / annual
  let baseHourly = 0;
  let baseAnnual = 0;

  if (input.rate != null && input.rate > 0) {
    const normalized = normalizeRateToBase({
      rate: input.rate,
      basis: input.rateBasis || config.base_rate_type || 'hourly',
      hoursPerDay: hours,
      daysPerMonth: days,
      monthsPerYear: months,
    });
    baseHourly = normalized.hourly;
    baseAnnual = normalized.annual;
  } else if (input.ctc != null && input.ctc > 0) {
    // Reverse from CTC: base = CTC / (1 + margin / 100)
    const markupFactor = 1 + margin / 100;
    baseAnnual = input.ctc / (markupFactor || 1);
    const baseMonthly = baseAnnual / months;
    baseHourly = baseMonthly / (days * hours);
  }

  const baseDaily = baseHourly * hours;
  const baseWeekly = baseDaily * 5;
  const baseMonthly = baseDaily * days;

  // Build evaluation context
  const context: Record<string, number> = {
    // Standard variables
    rate: input.rate ?? baseHourly,
    hourly_rate: baseHourly,
    daily_rate: baseDaily,
    weekly_rate: baseWeekly,
    monthly_rate: baseMonthly,
    annual_base: baseAnnual,
    hours_per_day: hours,
    working_days: days,
    months_per_year: months,
    margin: margin,
    margin_percent: margin,
    // Custom initial variables
    ...config.custom_variables,
    ...input.variableOverrides,
  };

  const stepDetails: StepEvaluationDetail[] = [];
  let hasError = false;
  let firstError: string | undefined;

  // Execute steps sequentially
  for (const step of config.steps || []) {
    try {
      const computedValue = evaluateExpression(step.expression, context);
      const rounded = Math.round(computedValue * 10000) / 10000;
      context[step.variable] = rounded;
      context[step.variable.toLowerCase()] = rounded;
      stepDetails.push({
        id: step.id,
        variable: step.variable,
        expression: step.expression,
        value: rounded,
      });
    } catch (err: any) {
      hasError = true;
      firstError = `Error evaluating ${step.variable} = ${step.expression}: ${err.message}`;
      stepDetails.push({
        id: step.id,
        variable: step.variable,
        expression: step.expression,
        value: 0,
        error: err.message,
      });
    }
  }

  // Final variable value
  const finalVarName = config.final_variable || 'final_ctc';
  const finalValue = context[finalVarName] ?? context[finalVarName.toLowerCase()] ?? (baseAnnual * (1 + margin / 100));

  const finalCTC = Math.round(finalValue * 100) / 100;
  const marginAmount = Math.max(0, finalCTC - baseAnnual);

  return {
    success: !hasError,
    finalValue: finalCTC,
    variables: context,
    stepDetails,
    error: firstError,
    rates: {
      hourly: Math.round(baseHourly * 100) / 100,
      weekly: Math.round(baseWeekly * 100) / 100,
      monthly: Math.round(baseMonthly * 100) / 100,
      annual_base: Math.round(baseAnnual * 100) / 100,
      final_ctc: finalCTC,
      margin_amount: Math.round(marginAmount * 100) / 100,
    },
  };
}

/**
 * Reverse calculation: takes a target Annual CTC and computes the equivalent Rate
 * (Hourly, Weekly, Monthly) given a formula config.
 */
export function reverseCalculateRateFromCTC(
  config: RateFormulaConfig,
  targetCTC: number,
  targetBasis: RateBasis = 'hourly'
): {
  rate: number;
  basis: RateBasis;
  baseAnnual: number;
  hourly: number;
  weekly: number;
  monthly: number;
} {
  const hours = config.working_hours_per_day || 8;
  const days = config.working_days_per_month || 22;
  const months = config.months_per_year || 12;
  const margin = config.margin_percent ?? 30;

  const markupFactor = 1 + margin / 100;
  const baseAnnual = targetCTC / (markupFactor || 1);
  const monthly = baseAnnual / months;
  const daily = monthly / days;
  const hourly = daily / hours;
  const weekly = daily * 5;

  let rate = hourly;
  if (targetBasis === 'weekly') rate = weekly;
  if (targetBasis === 'monthly') rate = monthly;

  return {
    rate: Math.round(rate * 100) / 100,
    basis: targetBasis,
    baseAnnual: Math.round(baseAnnual * 100) / 100,
    hourly: Math.round(hourly * 100) / 100,
    weekly: Math.round(weekly * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
  };
}
