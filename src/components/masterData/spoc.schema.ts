import { z } from 'zod';

/** One client or end-client SPOC. Email is optional; a blank string is "not provided". */
export const spocItemSchema = z.object({
  name: z.string().trim().min(1, 'SPOC name is required').max(255),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid SPOC email')]).optional(),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  designation: z.string().trim().max(100).optional().or(z.literal('')),
});

export const spocListSchema = z.array(spocItemSchema);

export type SpocItem = z.infer<typeof spocItemSchema>;

/**
 * A client (company) SPOC. Adds the client-only fields and the row id.
 *
 * `id` lets a save update the same company_spocs row instead of recreating it: demands keep
 * the picked SPOCs as ids (demands.client_spoc_ids), so recreating rows would silently drop
 * them from every demand. A row without an id is new.
 */
export const clientSpocItemSchema = spocItemSchema.extend({
  id: z.string().uuid().optional().or(z.literal('')),
  vertical: z.string().trim().max(100).optional().or(z.literal('')),
  supervisor: z.string().trim().max(255).optional().or(z.literal('')),
  supervisor_designation: z.string().trim().max(100).optional().or(z.literal('')),
  /** Missing = active, so older clients that never send it keep every SPOC active. */
  is_active: z.boolean().optional(),
});

export const clientSpocListSchema = z.array(clientSpocItemSchema);

export type ClientSpocItem = z.infer<typeof clientSpocItemSchema>;
