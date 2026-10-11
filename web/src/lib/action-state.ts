import { z } from 'zod'

/** Uniform result shape for Server Actions consumed with useActionState. */
export interface ActionState {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Record<string, string[] | undefined>
  /** Echo of submitted text values so forms keep input after a failed submit. */
  values?: Record<string, string>
}

export const idleState: ActionState = { status: 'idle' }

export function fromZodError(error: z.ZodError, values?: Record<string, string>): ActionState {
  return {
    status: 'error',
    message: 'Please fix the highlighted fields.',
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
    values,
  }
}

/** Plain-text form values (never files, never passwords) for re-populating a form. */
export function echoValues(formData: FormData, omit: readonly string[] = ['password', 'confirmPassword']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of formData.entries()) {
    if (typeof v === 'string' && !omit.includes(k) && !k.startsWith('$')) out[k] = v
  }
  return out
}
