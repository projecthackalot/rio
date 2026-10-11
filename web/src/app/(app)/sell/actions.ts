'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/auth/dal'
import { echoValues, fromZodError, type ActionState } from '@/lib/action-state'
import { rpcErrorMessage } from '@/lib/rpc-errors'
import { EXTENSIONS, MAX_PHOTOS, listingSchema, validatePhoto } from '@/lib/validation/listing'

type Supabase = Awaited<ReturnType<typeof createClient>>

function photosFrom(formData: FormData): File[] {
  return formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
}

/** Uploads with the user's own session: storage RLS confines writes to `<uid>/…`. */
async function uploadPhotos(supabase: Supabase, userId: string, listingId: string, files: File[], alt: string, title: string, startPosition: number) {
  const errors: string[] = []
  let position = startPosition
  for (const file of files) {
    const path = `${userId}/${listingId}/${randomUUID()}.${EXTENSIONS[file.type as keyof typeof EXTENSIONS]}`
    const { error: upErr } = await supabase.storage.from('listing-media').upload(path, file, { contentType: file.type, upsert: false })
    if (upErr) {
      console.error('[listing:upload]', upErr.message.slice(0, 120))
      errors.push(`“${file.name}” couldn’t be uploaded.`)
      continue
    }
    const altText = (alt || title).slice(0, 180) + (files.length > 1 ? ` (photo ${position + 1})` : '')
    const { error: rowErr } = await supabase
      .from('listing_media')
      .insert({ listing_id: listingId, storage_path: path, alt_text: altText.length >= 3 ? altText : `${title} photo`, position })
    if (rowErr) {
      await supabase.storage.from('listing-media').remove([path])
      errors.push(`“${file.name}” couldn’t be attached.`)
      continue
    }
    position++
  }
  return errors
}

async function checkPhotos(files: File[], existing = 0): Promise<string | null> {
  if (files.length + existing > MAX_PHOTOS) return `You can add up to ${MAX_PHOTOS} photos.`
  for (const f of files) {
    const problem = await validatePhoto(f)
    if (problem) return problem
  }
  return null
}

export async function createListingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer()
  if (!viewer) redirect('/auth/login?next=/sell/new')
  const values = echoValues(formData)
  const parsed = listingSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([k]) => k !== 'photos')))
  if (!parsed.success) return fromZodError(parsed.error, values)
  const files = photosFrom(formData)
  const photoProblem = await checkPhotos(files)
  if (photoProblem) return { status: 'error', fieldErrors: { photos: [photoProblem] }, values }

  const { photoAlt, ...row } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.from('listings').insert(row).select('id').single()
  if (error || !data) {
    console.error('[listing:create]', error?.code)
    return { status: 'error', message: rpcErrorMessage(error), values }
  }
  const uploadErrors = await uploadPhotos(supabase, viewer.id, data.id, files, photoAlt, row.title, 0)
  revalidatePath('/marketplace')
  revalidatePath('/dashboard')
  redirect(`/items/${data.id}/edit?notice=${uploadErrors.length ? 'created-partial' : 'created'}`)
}

export async function updateListingAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!z.uuid().safeParse(listingId).success) return { status: 'error', message: 'Invalid item.' }
  const viewer = await getViewer()
  if (!viewer) redirect(`/auth/login?next=/items/${listingId}/edit`)
  const values = echoValues(formData)
  const parsed = listingSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([k]) => k !== 'photos')))
  if (!parsed.success) return fromZodError(parsed.error, values)

  const supabase = await createClient()
  const { count } = await supabase.from('listing_media').select('id', { count: 'exact', head: true }).eq('listing_id', listingId)
  const files = photosFrom(formData)
  const photoProblem = await checkPhotos(files, count ?? 0)
  if (photoProblem) return { status: 'error', fieldErrors: { photos: [photoProblem] }, values }

  const { photoAlt, ...row } = parsed.data
  // RLS: only the owner, and only while ACTIVE/WITHDRAWN. 0 rows updated means not allowed.
  const { data, error } = await supabase.from('listings').update(row).eq('id', listingId).select('id')
  if (error) return { status: 'error', message: rpcErrorMessage(error), values }
  if (!data?.length) return { status: 'error', message: 'This listing can’t be edited now (it may be in a transaction).', values }

  const { data: positions } = await supabase.from('listing_media').select('position').eq('listing_id', listingId)
  const next = Math.max(-1, ...(positions ?? []).map((p) => p.position)) + 1
  const uploadErrors = await uploadPhotos(supabase, viewer.id, listingId, files, photoAlt, row.title, next)
  revalidatePath(`/items/${listingId}`)
  revalidatePath(`/items/${listingId}/edit`)
  revalidatePath('/marketplace')
  return uploadErrors.length
    ? { status: 'error', message: `Saved, but some photos failed: ${uploadErrors.join(' ')}` }
    : { status: 'success', message: 'Changes saved. If you changed a price or the departure, the auction restarted from now.' }
}

export async function deletePhotoAction(listingId: string, mediaId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  if (!z.uuid().safeParse(mediaId).success) return { status: 'error', message: 'Invalid photo.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('listing_media').delete().eq('id', mediaId).select('storage_path')
  if (error || !data?.length) return { status: 'error', message: 'That photo can’t be removed.' }
  await supabase.storage.from('listing-media').remove(data.map((d) => d.storage_path))
  revalidatePath(`/items/${listingId}`)
  revalidatePath(`/items/${listingId}/edit`)
  return { status: 'success', message: 'Photo removed.' }
}
