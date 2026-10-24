'use client'

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { UploadCloud, X, AlertCircle, Loader2 } from 'lucide-react'
import { formatBytes } from '@/lib/format'
import { compressPhoto } from '@/lib/images/compress'
import { MAX_PHOTO_BYTES, MAX_UPLOAD_LABEL } from '@/lib/validation/listing'

interface PhotoUploaderProps {
  remainingSlots: number
  errors?: string[]
  defaultValueAlt?: string
}

interface Chosen {
  full: File
  thumb: File
  url: string
  name: string
  originalSize: number
}

/**
 * Photo picker with drag-and-drop and previews. Photos are compressed in the
 * browser before the form is submitted (see lib/images/compress.ts); the
 * compressed full-size and thumbnail files travel in two hidden inputs,
 * `photos` and `thumbs`, in matching order.
 */
export function PhotoUploader({ remainingSlots, errors, defaultValueAlt = '' }: PhotoUploaderProps) {
  const [chosen, setChosen] = useState<Chosen[]>([])
  const [processing, setProcessing] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const pickerRef = useRef<HTMLInputElement>(null)
  const fullRef = useRef<HTMLInputElement>(null)
  const thumbRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef<string[]>([])

  // Revoke preview URLs when the component unmounts.
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), [])

  // Keep the hidden inputs (what the form actually submits) in sync with the chosen photos.
  useEffect(() => {
    const sync = (input: HTMLInputElement | null, files: File[]) => {
      if (!input) return
      const dt = new DataTransfer()
      files.forEach((f) => dt.items.add(f))
      input.files = dt.files
    }
    sync(
      fullRef.current,
      chosen.map((c) => c.full),
    )
    sync(
      thumbRef.current,
      chosen.map((c) => c.thumb),
    )
  }, [chosen])

  async function addFiles(incoming: File[]) {
    setProblem(null)
    const room = remainingSlots - chosen.length
    const images = incoming.filter((f) => f.type.startsWith('image/'))
    if (images.length < incoming.length) setProblem('Only image files can be added.')
    const accepted = images.slice(0, Math.max(0, room))
    if (images.length > accepted.length) setProblem(`You can add up to ${remainingSlots} photo${remainingSlots === 1 ? '' : 's'}.`)
    if (!accepted.length) return

    setProcessing((n) => n + accepted.length)
    const results: Chosen[] = []
    for (const file of accepted) {
      try {
        const { full, thumb } = await compressPhoto(file)
        const url = URL.createObjectURL(thumb)
        urlsRef.current.push(url)
        results.push({ full, thumb, url, name: file.name, originalSize: file.size })
      } catch (error) {
        setProblem(error instanceof Error ? error.message : `“${file.name}” couldn’t be processed.`)
      } finally {
        setProcessing((n) => n - 1)
      }
    }
    setChosen((prev) => [...prev, ...results].slice(0, remainingSlots))
  }

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void addFiles(Array.from(e.target.files))
    e.target.value = '' // allow choosing the same file again after removing it
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) void addFiles(Array.from(e.dataTransfer.files))
  }

  const removePhoto = (index: number) => {
    setChosen((prev) => {
      const gone = prev[index]
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((_, i) => i !== index)
    })
  }

  const uploadBytes = chosen.reduce((acc, c) => acc + c.full.size + c.thumb.size, 0)
  const originalBytes = chosen.reduce((acc, c) => acc + c.originalSize, 0)
  const isOverSize = uploadBytes > MAX_PHOTO_BYTES

  return (
    <div className="space-y-4">
      {/* What the form submits: compressed files, kept in sync above. */}
      <input ref={fullRef} type="file" name="photos" multiple hidden aria-hidden="true" tabIndex={-1} />
      <input ref={thumbRef} type="file" name="thumbs" multiple hidden aria-hidden="true" tabIndex={-1} />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => pickerRef.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors sm:p-8 ${
          isDragging ? 'border-forest bg-forest-tint/30' : 'border-line hover:border-line-strong bg-chalk hover:bg-stone/30'
        }`}
      >
        <label htmlFor="photos-picker" className="sr-only">
          Choose photos
        </label>
        <input
          ref={pickerRef}
          id="photos-picker"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          multiple
          onChange={handlePick}
          onClick={(e) => e.stopPropagation()}
          className="sr-only"
        />

        <div className="bg-forest-tint/60 text-forest rounded-full p-3">
          <UploadCloud className="size-6 sm:size-7" aria-hidden="true" />
        </div>

        <p className="mt-3 text-center text-sm font-semibold">
          <span className="text-forest underline underline-offset-2">Click to choose photos</span> or drag and drop
        </p>
        <p className="text-muted mt-1 text-center text-xs">
          Up to {remainingSlots} photo{remainingSlots === 1 ? '' : 's'}. Large phone photos are shrunk automatically before upload.
        </p>
      </div>

      <div aria-live="polite" className="space-y-1">
        {processing > 0 && (
          <p className="text-muted flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Optimizing {processing} photo{processing === 1 ? '' : 's'}…
          </p>
        )}
        {(problem || isOverSize) && (
          <p role="alert" className="text-danger flex items-center gap-1.5 text-sm font-medium">
            <AlertCircle className="size-4" aria-hidden="true" />
            {isOverSize ? `These photos are still over ${MAX_UPLOAD_LABEL} after optimizing. Remove one.` : problem}
          </p>
        )}
      </div>

      {errors && errors.length > 0 && (
        <ul className="text-danger list-disc space-y-1 pl-5 text-sm">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}

      {chosen.length > 0 && (
        <div>
          <div className="text-muted mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              {chosen.length} of {remainingSlots} photo{chosen.length === 1 ? '' : 's'} ready
            </span>
            <span>
              {formatBytes(originalBytes)} → {formatBytes(uploadBytes)} to upload
            </span>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {chosen.map((photo, index) => (
              <li key={photo.url} className="group border-line bg-chalk relative aspect-square overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Preview of ${photo.name}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="hover:bg-danger focus-visible:ring-forest absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-black/70 text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  aria-label={`Remove photo ${photo.name}`}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label htmlFor="photoAlt" className="block text-sm font-medium">
          Describe the photos <span className="text-muted font-normal">(optional)</span>
        </label>
        <p id="photoAlt-hint" className="text-muted mt-0.5 mb-1.5 text-xs">
          For students using screen readers, e.g. “Blue study chair with armrests, small scratch on the base”.
        </p>
        <input
          id="photoAlt"
          name="photoAlt"
          type="text"
          maxLength={200}
          defaultValue={defaultValueAlt}
          aria-describedby="photoAlt-hint"
          className="border-line-strong bg-chalk block w-full rounded-lg border px-3 py-2.5 text-base"
          placeholder="Brief description of the photos"
        />
      </div>
    </div>
  )
}
