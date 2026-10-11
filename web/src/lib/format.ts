/** Display formatting. All times are shown in India Standard Time, labelled. */

const TZ = 'Asia/Kolkata'

const dateTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})
const dateOnly = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' })
const timeOnly = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })

export const formatDateTime = (d: Date | string | number) => `${dateTime.format(new Date(d))} IST`
export const formatDate = (d: Date | string | number) => dateOnly.format(new Date(d))
export const formatTime = (d: Date | string | number) => `${timeOnly.format(new Date(d))} IST`

/** "3d 4h", "5h 20m", "12m". Negative durations clamp to "0m". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`
  return `${minutes}m`
}

/** Value for <input type="datetime-local"> in IST. */
export function toISTLocalInput(d: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(d))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** Parses a datetime-local value entered in IST ("2026-05-01T18:30") into a Date. */
export function fromISTLocalInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const d = new Date(`${value}:00+05:30`)
  return Number.isNaN(d.getTime()) ? null : d
}
