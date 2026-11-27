import { z } from 'zod';

export const USER_ROLE_VALUES = ['super_admin', 'account_manager', 'spoc', 'hr', 'ta', 'viewer'] as const;
export const USER_STATUS_VALUES = ['ACTIVE', 'INACTIVE'] as const;

export const userSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  date_of_joining: z.string().optional().or(z.literal('')),
  role: z.enum(USER_ROLE_VALUES, { message: 'Select a valid role' }),
  status: z.enum(USER_STATUS_VALUES, { message: 'Select a valid status' }),
  // Optional here so the same schema covers both create and edit; UserForm
  // enforces "required on create" via superRefine, and the API only
  // hashes+stores it when non-empty (edit/change-password flows omit it).
  password: z.string().optional().or(z.literal('')),
});

export type UserFormValues = z.infer<typeof userSchema>;

/** Create-mode schema: same as userSchema but password is mandatory (min 8 chars). */
export const userCreateSchema = userSchema.superRefine((values, ctx) => {
  if (!values.password || values.password.length < 8) {
    ctx.addIssue({
      code: 'custom',
      path: ['password'],
      message: 'Password must be at least 8 characters',
    });
  }
});

/** Admin-initiated password reset: new password + confirmation, no old password required. */
export const changePasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm the new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

/** Self-service password change: requires the current password, unlike the admin reset flow. */
export const selfChangePasswordSchema = changePasswordSchema.and(
  z.object({
    oldPassword: z.string().min(1, 'Current password is required'),
  })
);

export type SelfChangePasswordValues = z.infer<typeof selfChangePasswordSchema>;

/** Employee access (Roles & Permissions): the screens switched off for one employee. */
export const userAccessSchema = z.object({
  blocked_modules: z.array(z.string()).max(50),
});

export type UserAccessValues = z.infer<typeof userAccessSchema>;
