import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tone = 'info' | 'success' | 'warning' | 'error'

const tones: Record<Tone, { cls: string; Icon: typeof Info; label: string }> = {
  info: { cls: 'border-line bg-chalk text-ink', Icon: Info, label: 'Note' },
  success: { cls: 'border-forest/30 bg-forest-tint text-forest-strong', Icon: CheckCircle2, label: 'Done' },
  warning: { cls: 'border-amber/30 bg-amber-tint text-amber', Icon: AlertTriangle, label: 'Heads up' },
  error: { cls: 'border-danger/30 bg-danger-tint text-danger', Icon: XCircle, label: 'Problem' },
}

/**
 * Inline message. Errors use role="alert" (assertive), everything else
 * role="status" (polite) so screen readers announce changes after a submit.
 */
export function Notice({ tone = 'info', title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { cls, Icon, label } = tones[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', cls, className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-0.5">
        <p className="font-semibold">
          <span className="sr-only">{label}: </span>
          {title}
        </p>
        {children && <div className="text-[0.925rem] leading-relaxed">{children}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-card border-line-strong/60 bg-chalk/60 border border-dashed px-6 py-12 text-center">
      {icon && <div className="bg-forest-tint text-forest mx-auto mb-4 flex size-12 items-center justify-center rounded-full">{icon}</div>}
      <h2 className="text-xl">{title}</h2>
      {children && <div className="text-muted mx-auto mt-2 max-w-md">{children}</div>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('bg-line/60 animate-pulse rounded-md', className)} />
}

export function LoadingRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
