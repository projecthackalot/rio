'use client'

import { useActionState, useState } from 'react'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { CATEGORIES, CATEGORY_BY_SLUG, CONDITIONS, CONDITION_KEYS } from '@/domain/catalog'
import { formatINR } from '@/domain/money'
import { RENTAL_PERIODS, RENTAL_PERIOD_KEYS, quoteRental } from '@/domain/rental'
import { idleState, type ActionState } from '@/lib/action-state'
import { MAX_PHOTOS } from '@/lib/validation/listing'
import { PhotoUploader } from './photo-uploader'

export interface ListingDefaults {
  title?: string
  description?: string
  category?: string
  condition?: string
  startRupees?: string
  floorRupees?: string
  departure?: string
  noDeparture?: boolean
  rentable?: boolean
}

export function ListingForm({
  action,
  defaults = {},
  submitLabel,
  existingPhotos = 0,
  minDeparture,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  defaults?: ListingDefaults
  submitLabel: string
  existingPhotos?: number
  minDeparture: string
}) {
  const [state, formAction] = useActionState(action, idleState)
  const v = { ...defaults, ...(state.values ?? {}) } as Record<string, string | boolean | undefined>
  const [category, setCategory] = useState(String(v.category ?? ''))
  const [start, setStart] = useState(String(v.startRupees ?? ''))
  const [noDeparture, setNoDeparture] = useState(Boolean(v.noDeparture === true || v.noDeparture === 'on'))
  const [rentable, setRentable] = useState(Boolean(v.rentable === true || v.rentable === 'on'))
  const fe = state.fieldErrors ?? {}
  const cat = CATEGORY_BY_SLUG.get(category)
  const startPaise = Number(start) > 0 && Number.isInteger(Number(start)) ? Number(start) * 100 : null
  const remainingSlots = MAX_PHOTOS - existingPhotos

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {state.status === 'error' && state.message && <Notice tone="error" title={state.message} />}
      {state.status === 'success' && state.message && <Notice tone="success" title={state.message} />}

      <fieldset className="space-y-5">
        <legend className="font-display text-2xl font-semibold">The item</legend>
        <Field id="title" label="Title" hint="What a buyer would search for, e.g. “Symphony air cooler, 40L”." errors={fe.title}>
          {(a) => <Input {...a} name="title" required maxLength={80} defaultValue={String(v.title ?? '')} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="category" label="Category" errors={fe.category}>
            {(a) => (
              <Select {...a} name="category" required value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="" disabled>
                  Choose a category
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="condition" label="Condition" errors={fe.condition}>
            {(a) => (
              <Select {...a} name="condition" required defaultValue={String(v.condition ?? 'good')}>
                {CONDITION_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {CONDITIONS[k].label}: {CONDITIONS[k].description}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field
          id="description"
          label="Description"
          optional
          hint="Size, brand, age, any faults. Don’t include your room number: you’ll arrange the meeting after a claim."
          errors={fe.description}
        >
          {(a) => <Textarea {...a} name="description" maxLength={2000} rows={5} defaultValue={String(v.description ?? '')} />}
        </Field>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-2xl font-semibold">Price and timing</legend>
        <p className="text-muted text-sm">
          Your price drops in a straight line from the starting price to your floor, reaching the floor 2 hours before you leave. It never goes lower.
          {cat && cat.embodiedCo2eKg > 0 && (
            <>
              {' '}
              Typical for this category: {formatINR(cat.defaultStartPaise)} start, {formatINR(cat.defaultFloorPaise)} floor.
            </>
          )}
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="startRupees" label="Starting price (₹)" errors={fe.startRupees}>
            {(a) => (
              <Input
                {...a}
                name="startRupees"
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                step={1}
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            )}
          </Field>
          <Field id="floorRupees" label="Floor price (₹)" hint="The lowest you’ll accept." errors={fe.floorRupees}>
            {(a) => (
              <Input
                {...a}
                name="floorRupees"
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                step={1}
                required
                defaultValue={String(v.floorRupees ?? '')}
              />
            )}
          </Field>
        </div>
        <Checkbox name="noDeparture" label="No departure date: keep a fixed price" checked={noDeparture} onChange={(e) => setNoDeparture(e.target.checked)} />
        {!noDeparture && (
          <Field
            id="departure"
            label="When do you leave campus? (IST)"
            hint="At least 3 hours from now. In your final hour, unsold items go to campus staff."
            errors={fe.departure}
          >
            {(a) => <Input {...a} name="departure" type="datetime-local" required min={minDeparture} defaultValue={String(v.departure ?? '')} />}
          </Field>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-2xl font-semibold">Renting</legend>
        <Checkbox name="rentable" label="Also let people rent it" checked={rentable} onChange={(e) => setRentable(e.target.checked)} />
        {rentable && (
          <div className="border-line bg-stone/60 rounded-lg border p-4 text-sm" aria-live="polite">
            {startPaise ? (
              <ul className="grid gap-1 sm:grid-cols-3">
                {RENTAL_PERIOD_KEYS.map((p) => {
                  const q = quoteRental(startPaise, p)
                  return (
                    <li key={p}>
                      <span className="font-medium">{RENTAL_PERIODS[p].label}:</span> {formatINR(q.rentPaise)} rent + {formatINR(q.depositPaise)} deposit
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-muted">Enter a starting price to see what renters will pay.</p>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display text-2xl font-semibold">Photos</legend>
        {remainingSlots > 0 ? (
          <PhotoUploader remainingSlots={remainingSlots} errors={fe.photos} defaultValueAlt={String(v.photoAlt ?? '')} />
        ) : (
          <p className="text-muted text-sm">You’ve added the maximum of {MAX_PHOTOS} photos. Remove one to add another.</p>
        )}
      </fieldset>

      <SubmitButton size="lg" pendingLabel="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  )
}
