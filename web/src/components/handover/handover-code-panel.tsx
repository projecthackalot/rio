'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { CheckCircle2, QrCode, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { formatHandoverCode } from '@/domain/handoverCode'
import { handoverStatusAction, issueHandoverCodeAction, type HandoverPurpose, type IssuedCode } from '@/app/(app)/actions'

const COPY: Record<HandoverPurpose, { button: string; instruction: string }> = {
  CLAIM: {
    button: 'Show handover code',
    instruction: 'Hand over the item, then let the buyer scan this code. Scanning confirms they received it and releases payment to you.',
  },
  RENTAL_PICKUP: { button: 'Show pickup code', instruction: 'Let the renter scan this when they collect the item. Their rental starts on scan.' },
  RENTAL_RETURN: {
    button: 'Show return code',
    instruction: 'When you return the item, the owner scans this code to confirm. Your deposit is refunded on a clean return.',
  },
  STAFF_CUSTODY: { button: 'Show custody code', instruction: 'Campus staff or your warden scans this code when they take the item.' },
}

/**
 * Giver's side of a handover: requests a fresh single-use code from the
 * server, shows it as a QR + typed code, counts down to expiry, and polls
 * until the receiver has scanned it.
 */
export function HandoverCodePanel({ purpose, subjectId }: { purpose: HandoverPurpose; subjectId: string }) {
  const [issued, setIssued] = useState<IssuedCode | null>(null)
  const [status, setStatus] = useState<'pending' | 'consumed' | 'expired' | 'revoked' | 'unknown'>('pending')
  const [remaining, setRemaining] = useState(0)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const headingRef = useRef<HTMLHeadingElement>(null)

  const issue = useCallback(() => {
    startTransition(async () => {
      const result = await issueHandoverCodeAction(purpose, subjectId)
      setIssued(result)
      if (result.ok) setRemaining(Math.max(0, new Date(result.expiresAt).getTime() - Date.now()))
      setStatus('pending')
      requestAnimationFrame(() => headingRef.current?.focus())
    })
  }, [purpose, subjectId])

  const live = issued?.ok ? issued : null

  useEffect(() => {
    if (!live || status !== 'pending') return
    const tick = () => setRemaining(Math.max(0, new Date(live.expiresAt).getTime() - Date.now()))
    tick()
    const clock = setInterval(tick, 1000)
    const poll = setInterval(async () => {
      const s = await handoverStatusAction(live.tokenId)
      if (s !== 'pending') {
        setStatus(s)
        if (s === 'consumed') router.refresh()
      }
    }, 4000)
    return () => {
      clearInterval(clock)
      clearInterval(poll)
    }
  }, [live, status, router])

  const expired = live !== null && status === 'pending' && remaining === 0

  if (!issued) {
    return (
      <Button onClick={issue} disabled={pending} aria-disabled={pending}>
        <QrCode aria-hidden="true" className="size-4" />
        {pending ? 'Generating…' : COPY[purpose].button}
      </Button>
    )
  }

  if (!issued.ok) {
    return (
      <div className="space-y-3">
        <Notice tone="error" title={issued.message} />
        <Button variant="secondary" onClick={issue} disabled={pending}>
          Try again
        </Button>
      </div>
    )
  }

  if (status === 'consumed') {
    return (
      <div role="status" className="rounded-card border-forest/30 bg-forest-tint text-forest-strong flex items-start gap-3 border p-4">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <p className="font-semibold">Scanned and confirmed. This handover is complete.</p>
      </div>
    )
  }

  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)

  return (
    <section aria-labelledby={`code-${subjectId}`} className="rounded-card border-line bg-chalk border p-5">
      <h3 id={`code-${subjectId}`} ref={headingRef} tabIndex={-1} className="font-sans text-base font-semibold outline-none">
        Handover code
      </h3>
      <p className="text-muted mt-1 text-sm">{COPY[purpose].instruction}</p>
      <div className="mt-4 grid items-center gap-5 sm:grid-cols-[12rem_1fr]">
        <QrMatrix size={issued.qr.size} bits={issued.qr.bits} dimmed={Boolean(expired) || status !== 'pending'} />
        <div className="space-y-3">
          <p
            className="font-display tabular text-2xl font-semibold tracking-wider break-all select-all"
            aria-label={`Code: ${issued.code.split('').join(' ')}`}
          >
            {formatHandoverCode(issued.code)}
          </p>
          {status === 'pending' && !expired ? (
            <p className="text-muted text-sm" aria-live="off">
              Expires in{' '}
              <span className="tabular text-ink font-medium">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
              . Works once.
            </p>
          ) : (
            <p role="status" className="text-clay text-sm font-medium">
              {status === 'revoked' ? 'A newer code replaced this one.' : 'This code has expired.'}
            </p>
          )}
          <Button variant="secondary" size="sm" onClick={issue} disabled={pending}>
            <RefreshCw aria-hidden="true" className="size-4" />
            New code
          </Button>
        </div>
      </div>
    </section>
  )
}

function QrMatrix({ size, bits, dimmed }: { size: number; bits: string; dimmed: boolean }) {
  let d = ''
  for (let i = 0; i < bits.length; i++) if (bits[i] === '1') d += `M${i % size} ${Math.floor(i / size)}h1v1h-1z`
  const q = 2 // quiet zone
  return (
    <svg
      viewBox={`${-q} ${-q} ${size + 2 * q} ${size + 2 * q}`}
      role="img"
      aria-label="QR code for this handover. The same code is printed beside it for manual entry."
      className={`rounded-media bg-chalk w-48 max-w-full ${dimmed ? 'opacity-30' : ''}`}
      shapeRendering="crispEdges"
    >
      <rect x={-q} y={-q} width={size + 2 * q} height={size + 2 * q} fill="#faf8f3" />
      <path d={d} fill="#1b2420" />
    </svg>
  )
}
