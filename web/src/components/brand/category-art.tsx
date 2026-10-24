import { cn } from '@/lib/cn'

/**
 * Line illustrations shown when a listing has no photo yet. They are clearly
 * drawings, never presented as photographs of the actual item.
 */
const PATHS: Record<string, React.ReactNode> = {
  'air-cooler': (
    <>
      <rect x="38" y="14" width="44" height="62" rx="6" />
      <path d="M46 24h28M46 30h28M46 36h28M46 42h28" />
      <circle cx="60" cy="58" r="9" />
      <path d="M60 49v18M51 58h18" />
      <path d="M42 76v4M78 76v4" />
    </>
  ),
  'foam-mattress': (
    <>
      <path d="M18 50l20-14h64l-20 14z" />
      <path d="M18 50v12h64V50M82 62l20-14V36" />
      <path d="M30 46h14M58 46h14" />
    </>
  ),
  'kettle-immersion': (
    <>
      <path d="M44 34h30l4 40H40z" />
      <path d="M74 42c10 0 12 14 2 18" />
      <path d="M44 34l-10-8" />
      <path d="M52 34v-6h14v6" />
      <path d="M38 78h42" />
    </>
  ),
  'drafter-board': (
    <>
      <rect x="22" y="20" width="76" height="52" rx="3" />
      <path d="M34 62l30-30M64 32l10 10M34 62l12 0" />
      <circle cx="64" cy="32" r="3" />
    </>
  ),
  'study-table-chair': (
    <>
      <path d="M18 40h56M24 40v36M68 40v36" />
      <path d="M30 40v-12h22v12" />
      <path d="M86 20v34h18M86 54v22M104 54v22M86 40h18" />
    </>
  ),
  other: (
    <>
      <path d="M30 34l30-14 30 14v32l-30 14-30-14z" />
      <path d="M30 34l30 14 30-14M60 48v32" />
    </>
  ),
}

/** `decorative` hides the drawing from assistive tech when adjacent text already names the category. */
export function CategoryArt({ slug, label, className, decorative = false }: { slug: string; label: string; className?: string; decorative?: boolean }) {
  return (
    <div className={cn('bg-forest-tint flex items-center justify-center', className)}>
      <svg
        viewBox="0 0 120 92"
        {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `Illustration: ${label} (no photo yet)` })}
        className="h-3/5 max-h-40 w-3/5"
      >
        <g fill="none" stroke="var(--color-forest)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {PATHS[slug] ?? PATHS.other}
        </g>
      </svg>
    </div>
  )
}
