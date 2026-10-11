import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Hourglass, Leaf, Lock, PackageCheck, ShieldAlert, Undo2, Users } from 'lucide-react'
import { STATUS_LABELS } from '@/domain/stateMachine'
import type { Urgency } from '@/domain/pricing'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'forest' | 'clay' | 'amber' | 'danger'

const toneCls: Record<Tone, string> = {
  neutral: 'bg-stone text-ink border-line',
  forest: 'bg-forest-tint text-forest-strong border-forest/20',
  clay: 'bg-clay-tint text-clay border-clay/25',
  amber: 'bg-amber-tint text-amber border-amber/25',
  danger: 'bg-danger-tint text-danger border-danger/25',
}

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', toneCls[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

const STATUS_TONE: Record<string, { tone: Tone; Icon: typeof Clock }> = {
  ACTIVE: { tone: 'forest', Icon: Leaf },
  RESERVED: { tone: 'amber', Icon: Lock },
  RENTED: { tone: 'amber', Icon: Clock },
  SOLD: { tone: 'neutral', Icon: PackageCheck },
  STAFF_PENDING: { tone: 'clay', Icon: Users },
  STAFF_CUSTODY: { tone: 'neutral', Icon: Users },
  WITHDRAWN: { tone: 'neutral', Icon: Undo2 },
  DISPUTED: { tone: 'danger', Icon: ShieldAlert },
  PENDING_HANDOVER: { tone: 'amber', Icon: Hourglass },
  COMPLETED: { tone: 'forest', Icon: CheckCircle2 },
  CANCELLED: { tone: 'neutral', Icon: Undo2 },
  REFUNDED: { tone: 'neutral', Icon: Undo2 },
  PENDING_PICKUP: { tone: 'amber', Icon: Hourglass },
  RETURNED: { tone: 'forest', Icon: CheckCircle2 },
  CONVERTED: { tone: 'forest', Icon: PackageCheck },
  OPEN: { tone: 'danger', Icon: AlertTriangle },
  RESOLVED_REFUND: { tone: 'neutral', Icon: CheckCircle2 },
  RESOLVED_RELEASE: { tone: 'neutral', Icon: CheckCircle2 },
  RESOLVED_DAMAGE: { tone: 'neutral', Icon: CheckCircle2 },
  PENDING: { tone: 'amber', Icon: Hourglass },
  ACCEPTED: { tone: 'forest', Icon: CheckCircle2 },
}

/** Status pill: icon + text, never colour alone. */
export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_TONE[status] ?? { tone: 'neutral' as Tone, Icon: Clock }
  return (
    <Badge tone={meta.tone} icon={<meta.Icon aria-hidden="true" className="size-3.5" />}>
      {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
    </Badge>
  )
}

const URGENCY: Record<Urgency, { tone: Tone; label: string }> = {
  KEEPER: { tone: 'neutral', label: 'Fixed price' },
  FRESH: { tone: 'forest', label: 'More than 2 days left' },
  DROPPING: { tone: 'amber', label: 'Leaving within 2 days' },
  CRITICAL: { tone: 'clay', label: 'Under 3 hours left' },
  FINAL_HOUR: { tone: 'danger', label: 'Final hour' },
  DEPARTED: { tone: 'neutral', label: 'Owner departed' },
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const u = URGENCY[urgency]
  return (
    <Badge tone={u.tone} icon={<Clock aria-hidden="true" className="size-3.5" />}>
      {u.label}
    </Badge>
  )
}

/** Marks every simulated amount so nobody mistakes it for real money. */
export function SandboxBadge({ className }: { className?: string }) {
  return (
    <Badge tone="amber" className={className}>
      Sandbox money
    </Badge>
  )
}
