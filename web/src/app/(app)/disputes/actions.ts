'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/auth/dal'
import { echoValues, fromZodError, type ActionState } from '@/lib/action-state'
import { rpcErrorMessage } from '@/lib/rpc-errors'
import { MAX_PHOTO_BYTES } from '@/lib/validation/listing'

const EVIDENCE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }

const openSchema = z
  .object({
    claimId: z.uuid().optional(),
    rentalId: z.uuid().optional(),
    reason: z.string().trim().min(10, 'Describe the problem in at least 10 characters.').max(1000, 'Keep it under 1,000 characters.'),
  })
  .refine((v) => Boolean(v.claimId) !== Boolean(v.rentalId), { message: 'Choose the transaction this is about.', path: ['reason'] })

export async function openDisputeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer()
  if (!viewer) redirect('/auth/login?next=/disputes')
  const values = echoValues(formData)
  const parsed = openSchema.safeParse({
    claimId: formData.get('claimId') || undefined,
    rentalId: formData.get('rentalId') || undefined,
    reason: formData.get('reason') ?? '',
  })
  if (!parsed.success) return fromZodError(parsed.error, values)

  const supabase = await createClient()
  let evidencePath: string | null = null
  const file = formData.get('evidence')
  if (file instanceof File && file.size > 0) {
    const ext = EVIDENCE_TYPES[file.type]
    if (!ext) return { status: 'error', fieldErrors: { evidence: ['Attach a JPEG, PNG, WebP image or a PDF.'] }, values }
    if (file.size > MAX_PHOTO_BYTES) return { status: 'error', fieldErrors: { evidence: ['The file must be 5 MB or smaller.'] }, values }
    evidencePath = `${viewer.id}/${randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('dispute-evidence').upload(evidencePath, file, { contentType: file.type })
    if (error) return { status: 'error', fieldErrors: { evidence: ['The file couldn’t be uploaded. Try again or submit without it.'] }, values }
  }

  const { data, error } = await supabase.rpc('open_dispute', {
    p_claim: parsed.data.claimId ?? null,
    p_rental: parsed.data.rentalId ?? null,
    p_reason: parsed.data.reason,
    p_evidence_path: evidencePath,
  })
  if (error) {
    if (evidencePath) await supabase.storage.from('dispute-evidence').remove([evidencePath])
    return { status: 'error', message: rpcErrorMessage(error), values }
  }
  revalidatePath('/activity')
  revalidatePath('/disputes')
  revalidatePath('/warden')
  redirect(`/disputes/${data}?notice=opened`)
}

const resolveSchema = z.object({
  outcome: z.enum(['RESOLVED_REFUND', 'RESOLVED_RELEASE', 'RESOLVED_DAMAGE'], { message: 'Choose a decision.' }),
  note: z.string().trim().min(5, 'Explain the decision (at least 5 characters).').max(1000),
})

export async function resolveDisputeAction(disputeId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!z.uuid().safeParse(disputeId).success) return { status: 'error', message: 'Invalid dispute.' }
  const values = echoValues(formData)
  const parsed = resolveSchema.safeParse({ outcome: formData.get('outcome'), note: formData.get('note') ?? '' })
  if (!parsed.success) return fromZodError(parsed.error, values)
  const supabase = await createClient()
  const { error } = await supabase.rpc('resolve_dispute', { p_dispute: disputeId, p_outcome: parsed.data.outcome, p_note: parsed.data.note })
  if (error) return { status: 'error', message: rpcErrorMessage(error), values }
  revalidatePath(`/disputes/${disputeId}`)
  revalidatePath('/disputes')
  revalidatePath('/warden')
  return { status: 'success', message: 'Decision recorded. Sandbox balances have been updated.' }
}
