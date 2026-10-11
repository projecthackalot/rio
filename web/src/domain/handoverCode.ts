/**
 * Handover codes. The database generates a 16-character Crockford base32 code
 * (80 bits of entropy) per handover, stores only its SHA-256 hash, and expires
 * it after 10 minutes. The same code is encoded in the QR and shown for manual
 * entry as XXXX-XXXX-XXXX-XXXX.
 *
 * Manual entry is normalised the Crockford way: case-insensitive, separators
 * ignored, O→0 and I/L→1. The SQL function applies the identical normalisation
 * before hashing.
 */

export const HANDOVER_CODE_LENGTH = 16
export const HANDOVER_TTL_MINUTES = 10
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Optional prefix used inside QR payloads so other QR codes are rejected early. */
export const QR_PREFIX = 'RIO:'

export function normalizeHandoverCode(input: string): string | null {
  let s = input.trim()
  if (s.toUpperCase().startsWith(QR_PREFIX)) s = s.slice(QR_PREFIX.length)
  s = s.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  if (s.length !== HANDOVER_CODE_LENGTH) return null
  for (const ch of s) if (!ALPHABET.includes(ch)) return null
  return s
}

export function formatHandoverCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code
}

export function handoverQrPayload(code: string): string {
  return `${QR_PREFIX}${code}`
}
