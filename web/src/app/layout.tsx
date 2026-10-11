import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

// Self-hosted variable fonts (SIL Open Font License, see ./fonts) — no build-time network dependency.
const bricolage = localFont({ src: './fonts/bricolage-grotesque-latin-wght-normal.woff2', variable: '--font-bricolage', weight: '200 800', display: 'swap' })
const instrument = localFont({ src: './fonts/instrument-sans-latin-wght-normal.woff2', variable: '--font-instrument', weight: '400 700', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'RIO · Hostel move-out marketplace', template: '%s · RIO' },
  description:
    'Sell, rent or hand over your hostel essentials before you leave campus. Prices drop as your departure nears; whatever is left goes to campus staff, not the bin.',
}

export const viewport: Viewport = {
  themeColor: '#1f4033',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${bricolage.variable} ${instrument.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="bg-forest text-chalk sr-only z-50 rounded-md px-4 py-3 font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}
