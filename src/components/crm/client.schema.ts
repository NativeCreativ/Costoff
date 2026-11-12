import { z } from 'zod';

export const clientSchema = z.object({
  name: z.string().min(1, 'Client account name is required'),
  industry: z.string(),
  location: z.string(),
  notes: z.string(),
});
