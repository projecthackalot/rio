import { formatINR, type Paise } from '@/domain/money'
import { auctionPhase, decayProgress } from '@/domain/pricing'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/cn'

interface PriceTagProps {
  currentPaise: Paise
  startPaise: Paise
  floorPaise: Paise
  listedAt: string | Date
  departureAt: string | Date | null
  now: number
  size?: 'card' | 'detail'
  className?: string
}

/**
 * The hang-tag: RIO's signature price display. Current price dominates; the
 * starting price and the seller's floor are always visible underneath, and a
 * rail shows how far along the decay window the listing is.
 */
export function PriceTag({ currentPaise, startPaise, floorPaise, listedAt, departureAt, now, size = 'card', className }: PriceTagProps) {
  const dep = departureAt ? new Date(departureAt).getTime() : null
  const phase = auctionPhase({ departureAt: dep }, now)
  const dropped = currentPaise < startPaise
  const atFloor = currentPaise === floorPaise && dep !== null
  const big = size === 'detail'

  return (
    <div className={cn('hang-tag border-line bg-chalk border py-2.5 pr-3', big && 'py-4 pr-5', className)}>
      <p className="sr-only">
        Current price {formatINR(currentPaise)}. Started at {formatINR(startPaise)}; will not go below {formatINR(floorPaise)}.
      </p>
      <div aria-hidden="true">
        <div className="flex items-baseline gap-2">
          <span className={cn('font-display tabular text-ink font-semibold tracking-tight', big ? 'text-4xl' : 'text-2xl')}>{formatINR(currentPaise)}</span>
          {dropped && <span className="tabular text-muted decoration-clay/60 text-sm line-through">{formatINR(startPaise)}</span>}
        </div>
        <div className={cn('text-muted tabular mt-1 flex flex-wrap gap-x-3', big ? 'text-sm' : 'text-xs')}>
          <span>
            Floor <span className="text-ink font-medium">{formatINR(floorPaise)}</span>
          </span>
          {atFloor ? <span className="text-clay font-medium">At floor</span> : null}
        </div>
      </div>
      {dep !== null && (
        <DecayRail
          progress={decayProgress({ startPaise, floorPaise, listedAt: new Date(listedAt), departureAt: dep }, now)}
          phase={phase}
          departureAt={dep}
          now={now}
          compact={!big}
        />
      )}
    </div>
  )
}

function DecayRail({ progress, phase, departureAt, now, compact }: { progress: number; phase: string; departureAt: number; now: number; compact: boolean }) {
  const remaining = departureAt - now
  const label = phase === 'departed' ? 'Owner has left' : phase === 'final_hour' ? `Final hour: staff pickup` : `Owner leaves in ${formatDuration(remaining)}`
  return (
    <div className={cn('mt-2.5', compact ? 'space-y-1' : 'space-y-1.5')}>
      <div className="bg-line relative h-1.5 rounded-full" role="presentation">
        <div className="bg-clay absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className={cn('text-muted', compact ? 'text-xs' : 'text-sm')}>{label}</p>
    </div>
  )
}
