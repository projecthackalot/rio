'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { buttonClass } from '@/components/ui/button'

/**
 * Share a listing: the phone's native share sheet (WhatsApp, Instagram…) where
 * available, otherwise copy the link. Campus listings mostly travel through
 * group chats, so this is the main way items reach buyers.
 */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const [status, setStatus] = useState<string | null>(null)

  async function share() {
    const url = new URL(path, window.location.origin).toString()
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} on RIO`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setStatus('Link copied')
    } catch (error) {
      // AbortError = the person closed the share sheet; not a failure.
      if ((error as DOMException)?.name !== 'AbortError') setStatus('Couldn’t share. Copy the address from your browser instead.')
    }
    setTimeout(() => setStatus(null), 4000)
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button type="button" onClick={share} className={buttonClass('secondary')}>
        <Share2 aria-hidden="true" className="size-4" /> Share
      </button>
      <span role="status" aria-live="polite" className="text-muted text-sm">
        {status}
      </span>
    </span>
  )
}
