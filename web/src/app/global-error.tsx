'use client'

/** Last-resort boundary (replaces the root layout), so it carries its own minimal styling. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#eeebe3', color: '#1b2420', padding: '4rem 1rem' }}>
        <main role="alert" style={{ maxWidth: '36rem', margin: '0 auto' }}>
          <h1 style={{ fontSize: '2rem' }}>RIO couldn’t load</h1>
          <p>Something went wrong while loading the app. No transaction was left half-finished.</p>
          {error.digest && <p>Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: '0 1.25rem', borderRadius: 8, border: 0, background: '#1f4033', color: '#faf8f3', fontSize: '1rem' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
