'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/auth/dal'
import { echoValues, fromZodError, type ActionState } from '@/lib/action-state'
import { rpcErrorMessage } from '@/lib/rpc-errors'
import { fromISTLocalInput } from '@/lib/format'

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

const settingsSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name.').max(80),
  hostelId: z.preprocess(blankToNull, z.uuid().nullable()),
  block: z.preprocess(blankToNull, z.string().trim().max(40).nullable()),
  room: z.preprocess(blankToNull, z.string().trim().max(20).nullable()),
  phone: z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .regex(/^[0-9+() -]{7,20}$/, 'Use digits, spaces, + or -, 7–20 characters.')
      .nullable(),
  ),
  departure: z.preprocess(blankToNull, z.string().nullable()),
})

/**
 * Updates only the columns the database lets a user change (column grants on
 * profiles / profile_private). Role, wallet and scope are not editable here
 * — the database would reject them even if they were sent.
 */
export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer()
  if (!viewer) return { status: 'error', message: 'Please sign in again.' }
  const values = echoValues(formData)
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fromZodError(parsed.error, values)
  const departure = parsed.data.departure ? fromISTLocalInput(parsed.data.departure) : null
  if (parsed.data.departure && !departure) return { status: 'error', fieldErrors: { departure: ['Enter a valid date and time.'] }, values }

  const supabase = await createClient()
  const [p1, p2] = await Promise.all([
    supabase.from('profiles').update({ full_name: parsed.data.fullName, hostel_id: parsed.data.hostelId }).eq('id', viewer.id),
    supabase
      .from('profile_private')
      .update({ block: parsed.data.block, room: parsed.data.room, phone: parsed.data.phone, departure_at: departure?.toISOString() ?? null })
      .eq('user_id', viewer.id),
  ])
  if (p1.error || p2.error) return { status: 'error', message: rpcErrorMessage(p1.error ?? p2.error), values }
  revalidatePath('/', 'layout')
  return { status: 'success', message: 'Settings saved.' }
}

const roleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(['student', 'warden', 'staff', 'admin']),
  hostels: z.array(z.uuid()).max(20),
})

export async function setRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = roleSchema.safeParse({ userId: formData.get('userId'), role: formData.get('role'), hostels: formData.getAll('hostels') })
  if (!parsed.success) return { status: 'error', message: 'Choose a person, a role and (for wardens/staff) at least one hostel.' }
  if ((parsed.data.role === 'warden' || parsed.data.role === 'staff') && parsed.data.hostels.length === 0) {
    return { status: 'error', message: 'Wardens and staff need at least one hostel, so their access is scoped.' }
  }
  const supabase = await createClient()
  // admin_set_role re-checks that the caller is an admin, blocks self-changes and writes an audit event.
  const { error } = await supabase.rpc('admin_set_role', { p_user: parsed.data.userId, p_role: parsed.data.role, p_hostels: parsed.data.hostels })
  if (error) return { status: 'error', message: rpcErrorMessage(error) }
  revalidatePath('/admin/roles')
  return { status: 'success', message: 'Role updated.' }
}
