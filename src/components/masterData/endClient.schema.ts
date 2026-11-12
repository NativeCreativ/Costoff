import { z } from 'zod';
import { COMPANY_STATUS_VALUES } from '@/components/companies/company.schema';
import { spocListSchema } from './spoc.schema';

export const endClientSchema = z.object({
  name: z.string().trim().min(1, 'End client name is required').max(255),
  location: z.string().trim().max(500).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  status: z.enum(COMPANY_STATUS_VALUES).optional(),
  spocs: spocListSchema.optional(),
});

export type EndClientValues = z.infer<typeof endClientSchema>;

export const endClientFormSchema = z.object({
  name: z.string().trim().min(1, 'End client name is required').max(255),
  location: z.string().trim().max(500),
  description: z.string().trim().max(2000),
  status: z.enum(COMPANY_STATUS_VALUES),
  spocs: spocListSchema,
});

export type EndClientFormValues = z.infer<typeof endClientFormSchema>;
