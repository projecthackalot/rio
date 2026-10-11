'use client'

import { useActionState } from 'react'
import { Field, Input, Select } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { idleState } from '@/lib/action-state'
import { saveSettingsAction, setRoleAction } from '@/app/(app)/settings/actions'

interface Hostel {
  id: string
  name: string
  campus: string
}

export function SettingsForm({
  defaults,
  hostels,
}: {
  defaults: { fullName: string; hostelId: string; block: string; room: string; phone: string; departure: string }
  hostels: Hostel[]
}) {
  const [state, action] = useActionState(saveSettingsAction, idleState)
  const v = { ...defaults, ...(state.values ?? {}) }
  const fe = state.fieldErrors ?? {}
  return (
    <form action={action} className="space-y-8" noValidate>
      {state.status === 'error' && state.message && <Notice tone="error" title={state.message} />}
      {state.status === 'success' && <Notice tone="success" title={state.message} />}
      <fieldset className="space-y-5">
        <legend className="font-display text-2xl font-semibold">Profile</legend>
        <p className="text-muted text-sm">Your name is visible to signed-in members you trade with.</p>
        <Field id="fullName" label="Full name" errors={fe.fullName}>
          {(a) => <Input {...a} name="fullName" autoComplete="name" required maxLength={80} defaultValue={v.fullName} />}
        </Field>
        <Field id="hostelId" label="Hostel" hint="Your listings show this hostel, and its warden handles your disputes." errors={fe.hostelId}>
          {(a) => (
            <Select {...a} name="hostelId" defaultValue={v.hostelId}>
              <option value="">Not set</option>
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {h.campus ? `, ${h.campus}` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </fieldset>
      <fieldset className="space-y-5">
        <legend className="font-display text-2xl font-semibold">Private details</legend>
        <p className="text-muted text-sm">Only you and your hostel’s warden can see these. They are never shown on listings.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="block" label="Block" optional errors={fe.block}>
            {(a) => <Input {...a} name="block" maxLength={40} defaultValue={v.block} />}
          </Field>
          <Field id="room" label="Room" optional errors={fe.room}>
            {(a) => <Input {...a} name="room" maxLength={20} defaultValue={v.room} />}
          </Field>
        </div>
        <Field id="phone" label="Phone" optional errors={fe.phone}>
          {(a) => <Input {...a} name="phone" type="tel" autoComplete="tel" maxLength={20} defaultValue={v.phone} />}
        </Field>
        <Field id="departure" label="Planned departure (IST)" optional hint="Used for your warden’s no-dues check." errors={fe.departure}>
          {(a) => <Input {...a} name="departure" type="datetime-local" defaultValue={v.departure} />}
        </Field>
      </fieldset>
      <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
    </form>
  )
}

export function RoleForm({ people, hostels }: { people: { id: string; name: string; role: string }[]; hostels: Hostel[] }) {
  const [state, action] = useActionState(setRoleAction, idleState)
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.status === 'error' && state.message && <Notice tone="error" title={state.message} />}
      {state.status === 'success' && <Notice tone="success" title={state.message} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="userId" label="Person">
          {(a) => (
            <Select {...a} name="userId" required defaultValue="">
              <option value="" disabled>
                Choose a person
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="role" label="New role">
          {(a) => (
            <Select {...a} name="role" required defaultValue="warden">
              <option value="student">Student</option>
              <option value="warden">Warden</option>
              <option value="staff">Staff</option>
              <option value="admin">Administrator</option>
            </Select>
          )}
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Hostels this person can act on (wardens and staff)</legend>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {hostels.map((h) => (
            <label key={h.id} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="hostels" value={h.id} className="accent-forest size-5" />
              {h.name}
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton pendingLabel="Updating…">Update role</SubmitButton>
    </form>
  )
}
