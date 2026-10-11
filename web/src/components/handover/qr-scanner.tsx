'use client'

import { useEffect, useRef, useState } from 'react'
import { normalizeHandoverCode } from '@/domain/handoverCode'

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike
  }
}

/**
 * Camera QR scanner. Loaded lazily (next/dynamic) only after the person asks
 * for the camera. Uses the native BarcodeDetector where available and falls
 * back to jsQR (also lazily imported). Only RIO handover codes are accepted.
 */
export default function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState('Starting camera…')

  useEffect(() => {
    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser can’t use the camera here. Type the code instead.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      } catch (e) {
        const name = (e as DOMException).name
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow it in your browser settings, or type the code instead.'
            : 'No camera is available. Type the code instead.',
        )
        return
      }
      const video = videoRef.current
      if (!video || stopped) return
      video.srcObject = stream
      await video.play().catch(() => {})
      setHint('Point the camera at the handover QR code.')

      const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null
      const jsQR = detector ? null : (await import('jsqr')).default

      const scan = async () => {
        if (stopped || !video.videoWidth) {
          frame = requestAnimationFrame(scan)
          return
        }
        let value: string | null = null
        if (detector) {
          const found = await detector.detect(video).catch(() => [])
          value = found[0]?.rawValue ?? null
        } else if (jsQR && ctx) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
          value = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
        }
        const code = value ? normalizeHandoverCode(value) : null
        if (code) {
          stopped = true
          onCode(code)
          return
        }
        if (value) setHint('That QR code isn’t a RIO handover code.')
        frame = requestAnimationFrame(scan)
      }
      frame = requestAnimationFrame(scan)
    }

    start()
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onCode])

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="border-danger/30 bg-danger-tint text-danger rounded-lg border px-4 py-3 text-sm font-medium">
          {error}
        </p>
      ) : (
        <>
          <video ref={videoRef} muted playsInline className="rounded-card bg-ink aspect-square w-full max-w-sm object-cover" aria-label="Camera preview" />
          <p role="status" className="text-muted text-sm">
            {hint}
          </p>
        </>
      )}
      <button type="button" onClick={onClose} className="text-forest min-h-11 text-sm font-medium underline underline-offset-4">
        Close camera
      </button>
    </div>
  )
}
