'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/auth/dal'
import { rioErrorCode, rpcErrorMessage } from '@/lib/rpc-errors'
import type { ActionState } from '@/lib/action-state'
import { handoverQrPayload, normalizeHandoverCode } from '@/domain/handoverCode'
import { RENTAL_PERIOD_KEYS } from '@/domain/rental'

const uuid = z.uuid()

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null; code: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const code = rioErrorCode(error)
    // Expected business-rule refusals are not server errors; log only unexpected ones (no payloads).
    if (!code) console.error(`[rpc:${fn}]`, error.code, error.message.slice(0, 200))
    return { data: null, error: rpcErrorMessage(error), code }
  }
  return { data: data as T, error: null, code: null }
}

function revalidateTransactionViews(listingId?: string) {
  revalidatePath('/dashboard')
  revalidatePath('/activity')
  revalidatePath('/marketplace')
  if (listingId) revalidatePath(`/items/${listingId}`)
}

const fail = (message: string): ActionState => ({ status: 'error', message })

// ── Claims ──────────────────────────────────────────────────────────────
export async function claimListingAction(listingId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  if (!uuid.safeParse(listingId).success) return fail('Invalid item.')
  if (!(await getViewer())) redirect(`/auth/login?next=/items/${listingId}`)
  const { data, error } = await rpc<string>('claim_listing', { p_listing: listingId })
  if (error) return fail(error)
  revalidateTransactionViews(listingId)
  redirect(`/activity?notice=claimed&claim=${data}`)
}

export async function cancelClaimAction(claimId: string, listingId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  if (!uuid.safeParse(claimId).success) return fail('Invalid claim.')
  const { error } = await rpc('cancel_claim', { p_claim: claimId })
  if (error) return fail(error)
  revalidateTransactionViews(listingId)
  return { status: 'success', message: 'Claim cancelled. The sandbox escrow has been returned to the buyer.' }
}

// ── Rentals ─────────────────────────────────────────────────────────────
const rentalSchema = z.object({ period: z.enum(RENTAL_PERIOD_KEYS as [string, ...string[]], { message: 'Choose a rental period.' }) })

export async function startRentalAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!uuid.safeParse(listingId).success) return fail('Invalid item.')
  if (!(await getViewer())) redirect(`/auth/login?next=/items/${listingId}`)
  const parsed = rentalSchema.safeParse({ period: formData.get('period') })
  if (!parsed.success) return { status: 'error', fieldErrors: { period: ['Choose a rental period.'] } }
  const { data, error } = await rpc<string>('start_rental', { p_listing: listingId, p_period: parsed.data.period })
  if (error) return fail(error)
  revalidateTransactionViews(listingId)
  redirect(`/rentals/${data}?notice=booked`)
}

export async function cancelRentalAction(rentalId: string, listingId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  if (!uuid.safeParse(rentalId).success) return fail('Invalid rental.')
  const { error } = await rpc('cancel_rental', { p_rental: rentalId })
  if (error) return fail(error)
  revalidateTransactionViews(listingId)
  revalidatePath(`/rentals/${rentalId}`)
  return { status: 'success', message: 'Rental cancelled. Rent and deposit were returned (sandbox).' }
}

export async function convertRentalAction(rentalId: string, listingId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  if (!uuid.safeParse(rentalId).success) return fail('Invalid rental.')
  const { error } = await rpc<number>('convert_rental_to_purchase', { p_rental: rentalId })
  if (error) return fail(error)
  revalidateTransactionViews(listingId)
  revalidatePath(`/rentals/${rentalId}`)
  return { status: 'success', message: 'It’s yours. Your deposit was refunded and the purchase settled in sandbox money.' }
}

// ── Handover tokens ─────────────────────────────────────────────────────
const purposeSchema = z.enum(['CLAIM', 'RENTAL_PICKUP', 'RENTAL_RETURN', 'STAFF_CUSTODY'])
export type HandoverPurpose = z.infer<typeof purposeSchema>

export type IssuedCode = { ok: true; tokenId: string; code: string; expiresAt: string; qr: { size: number; bits: string } } | { ok: false; message: string }

export async function issueHandoverCodeAction(purpose: HandoverPurpose, subjectId: string): Promise<IssuedCode> {
  if (!purposeSchema.safeParse(purpose).success || !uuid.safeParse(subjectId).success) return { ok: false, message: 'Invalid handover.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('issue_handover_token', { p_purpose: purpose, p_subject: subjectId })
  if (error) return { ok: false, message: rpcErrorMessage(error) }
  const row = (Array.isArray(data) ? data[0] : data) as { token_id: string; code: string; expires_at: string }
  // Send the QR module matrix, not markup: the client draws it as an SVG path.
  const matrix = QRCode.create(handoverQrPayload(row.code), { errorCorrectionLevel: 'M' }).modules
  const bits = Array.from(matrix.data, (b) => (b ? '1' : '0')).join('')
  return { ok: true, tokenId: row.token_id, code: row.code, expiresAt: row.expires_at, qr: { size: matrix.size, bits } }
}

/** Polled by the giver's screen so it can confirm the moment the code is scanned. */
export async function handoverStatusAction(tokenId: string): Promise<'pending' | 'consumed' | 'expired' | 'revoked' | 'unknown'> {
  if (!uuid.safeParse(tokenId).success) return 'unknown'
  const supabase = await createClient()
  const { data } = await supabase.from('handover_tokens').select('consumed_at, revoked_at, expires_at').eq('id', tokenId).maybeSingle()
  if (!data) return 'unknown'
  if (data.consumed_at) {
    revalidateTransactionViews()
    return 'consumed'
  }
  if (data.revoked_at) return 'revoked'
  if (new Date(data.expires_at).getTime() <= Date.now()) return 'expired'
  return 'pending'
}

const consumeSchema = z.object({
  code: z.string().trim().min(1, 'Enter the handover code.').max(40),
  reportDamage: z.preprocess((v) => v === 'on' || v === 'true', z.boolean()),
  damageNote: z.string().trim().max(1000).optional(),
})

export interface ConsumeState extends ActionState {
  purpose?: HandoverPurpose
  listingId?: string
  disputeId?: string
}

export async function consumeHandoverCodeAction(_prev: ConsumeState, formData: FormData): Promise<ConsumeState> {
  const parsed = consumeSchema.safeParse({
    code: formData.get('code') ?? '',
    reportDamage: formData.get('reportDamage'),
    damageNote: formData.get('damageNote') || undefined,
  })
  if (!parsed.success) return { status: 'error', fieldErrors: { code: ['Enter the handover code.'] } }
  const code = normalizeHandoverCode(parsed.data.code)
  if (!code) {
    return { status: 'error', fieldErrors: { code: ['Codes are 16 letters and numbers, like ABCD-EFGH-JKMN-PQRS.'] }, values: { code: parsed.data.code } }
  }
  if (parsed.data.reportDamage && (parsed.data.damageNote?.length ?? 0) < 10) {
    return { status: 'error', fieldErrors: { damageNote: ['Describe the damage in at least 10 characters.'] }, values: { code: parsed.data.code } }
  }
  const { data, error } = await rpc<{ purpose: HandoverPurpose; listing_id: string; dispute_id: string | null }>('consume_handover_token', {
    p_code: code,
    p_report_damage: parsed.data.reportDamage,
    p_damage_note: parsed.data.damageNote ?? null,
  })
  if (error || !data) return { status: 'error', message: error ?? 'Handover failed.', values: { code: parsed.data.code } }
  revalidateTransactionViews(data.listing_id)
  revalidatePath('/staff')
  revalidatePath('/warden')
  const messages: Record<HandoverPurpose, string> = {
    CLAIM: 'Handover confirmed. The sale is settled and the seller has been paid (sandbox).',
    RENTAL_PICKUP: 'Pickup confirmed. Your rental has started and the rent was released to the owner (sandbox).',
    RENTAL_RETURN: data.dispute_id
      ? 'Return recorded with a damage report. A warden will review it; the deposit stays held until then.'
      : 'Return confirmed. The renter’s deposit has been refunded (sandbox).',
    STAFF_CUSTODY: 'Custody accepted. The item is now with campus staff.',
  }
  return { status: 'success', message: messages[data.purpose], purpose: data.purpose, listingId: data.listing_id, disputeId: data.dispute_id ?? undefined }
}

// ── Listing availability ────────────────────────────────────────────────
export async function setAvailabilityAction(listingId: string, available: boolean, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  if (!uuid.safeParse(listingId).success) return fail('Invalid item.')
  const { error } = await rpc('set_listing_availability', { p_listing: listingId, p_available: available })
  if (error) return fail(error)
  revalidateTransactionViews(listingId)
  return { status: 'success', message: available ? 'Your item is back on the marketplace.' : 'Your item is hidden from the marketplace.' }
}

// ── Staff routing (warden) ──────────────────────────────────────────────
export async function routeToStaffAction(listingId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  if (!uuid.safeParse(listingId).success) return fail('Invalid item.')
  const { error } = await rpc('route_to_staff', { p_listing: listingId })
  if (error) return fail(error)
  revalidatePath('/warden')
  revalidatePath('/staff')
  revalidateTransactionViews(listingId)
  return { status: 'success', message: 'Routed to staff. The owner can now show a custody code to campus staff.' }
}
