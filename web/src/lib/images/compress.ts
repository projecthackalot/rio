/**
 * Browser-side photo compression. Phone photos are 3–8 MB; listings need far
 * less. Each chosen photo becomes two files before upload:
 *   - full:  longest side 1600 px (~150–250 KB) for the item gallery
 *   - thumb: longest side 480 px (~30–50 KB) for marketplace cards
 * Smaller uploads keep each save well under the hosting request limit and stretch
 * the free storage/egress allowance to thousands of listings.
 *
 * WebP is preferred; browsers that can't encode WebP from a canvas (some Safari
 * versions return PNG) fall back to JPEG. EXIF orientation is applied.
 */

export interface CompressedPhoto {
  full: File
  thumb: File
}

export const FULL_MAX_SIDE = 1600
export const THUMB_MAX_SIDE = 480

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q))
  const webp = await toBlob('image/webp', quality)
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await toBlob('image/jpeg', Math.min(0.85, quality + 0.05))
  if (jpeg) return jpeg
  throw new Error('This browser could not process the image.')
}

function draw(source: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser could not process the image.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

function rename(original: string, suffix: string, type: string): string {
  const base =
    original
      .replace(/\.[^.]+$/, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .slice(0, 60) || 'photo'
  return `${base}${suffix}.${type === 'image/webp' ? 'webp' : 'jpg'}`
}

export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  if (!file.type.startsWith('image/')) throw new Error(`“${file.name}” isn’t an image.`)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`“${file.name}” couldn’t be read. Try a JPEG or PNG.`)
  }
  try {
    const fullBlob = await encode(draw(bitmap, FULL_MAX_SIDE), 0.8)
    const thumbBlob = await encode(draw(bitmap, THUMB_MAX_SIDE), 0.72)
    return {
      full: new File([fullBlob], rename(file.name, '', fullBlob.type), { type: fullBlob.type }),
      thumb: new File([thumbBlob], rename(file.name, '-thumb', thumbBlob.type), { type: thumbBlob.type }),
    }
  } finally {
    bitmap.close()
  }
}
