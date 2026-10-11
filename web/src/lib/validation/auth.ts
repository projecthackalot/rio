import { z } from 'zod'

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address.' }))
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.').max(72),
  next: z.string().optional(),
})

/**
 * Public signup. There is intentionally NO role field: every new account is
 * a student, enforced by the database trigger regardless of what is sent.
 */
export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your name.').max(80, 'Use at most 80 characters.'),
    email,
    password,
    confirmPassword: z.string(),
    next: z.string().optional(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords don’t match.' })

export const emailOnlySchema = z.object({ email, next: z.string().optional() })

export const updatePasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords don’t match.' })

export const OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const
export const otpTypeSchema = z.enum(OTP_TYPES)
