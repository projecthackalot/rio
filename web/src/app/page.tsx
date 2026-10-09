import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="bg-white min-h-screen">
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5">
              <span className="text-2xl font-black tracking-tighter text-orange-600">RIO</span>
            </Link>
          </div>
          <div className="flex flex-1 justify-end">
            {user ? (
              <Link href="/dashboard" className="text-sm font-semibold leading-6 text-zinc-900 hover:text-orange-600">
                Go to Dashboard <span aria-hidden="true">&rarr;</span>
              </Link>
            ) : (
              <Link href="/auth/login" className="text-sm font-semibold leading-6 text-zinc-900 hover:text-orange-600">
                Log in <span aria-hidden="true">&rarr;</span>
              </Link>
            )}
          </div>
        </nav>
      </header>

      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl">
              Nothing moves. Nothing gets dumped.
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-600">
              The hyper-local circular economy platform for hostels & PGs. Leave your stuff exactly where it is.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/auth/login"
                className="rounded-full bg-orange-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 transition-all"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
