import { z } from 'zod';

/** Currency master (Demand Fulfillment Settings). Code is the uniqueness key — e.g. INR, USD. */
export const compensationCurrencySchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(10, 'Code must be 10 characters or fewer').toUpperCase(),
  name: z.string().trim().min(1, 'Name is required'),
  symbol: z.string().trim().min(1, 'Symbol is required').max(10),
});
export type CompensationCurrencyValues = z.infer<typeof compensationCurrencySchema>;

/** Compensation Type (frequency) master — e.g. Hourly, Monthly, Yearly. Name is the uniqueness key. */
export const compensationTypeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
});
export type CompensationTypeValues = z.infer<typeof compensationTypeSchema>;

/** Reorder payload for either master: the full list of ids in their new display order. */
export const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1, 'orderedIds is required'),
});
export type ReorderValues = z.infer<typeof reorderSchema>;
