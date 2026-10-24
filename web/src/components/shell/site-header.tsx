import { Suspense } from 'react'
import Link from 'next/link'
import { ChevronDown, Heart, LogOut, Settings } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { ButtonLink } from '@/components/ui/button'
import { NavLinks, TabBar, type NavKey } from './nav-links'
import { getViewer, type Viewer } from '@/lib/auth/dal'
import { getWalletBalance } from '@/lib/data/wallet'
import { formatINR } from '@/domain/money'
import { logout } from '@/app/auth/actions'

export function navFor(viewer: Viewer | null): { desktop: NavKey[]; mobile: NavKey[] } {
  if (!viewer) return { desktop: ['marketplace', 'howItWorks', 'help'], mobile: ['marketplace', 'howItWorks', 'help'] }
  if (viewer.role === 'admin')
    return { desktop: ['marketplace', 'warden', 'staff', 'disputes', 'admin'], mobile: ['marketplace', 'warden', 'handover', 'admin'] }
  if (viewer.role === 'warden') return { desktop: ['warden', 'marketplace', 'handover', 'disputes'], mobile: ['warden', 'marketplace', 'handover', 'disputes'] }
  if (viewer.role === 'staff') return { desktop: ['staff', 'handover', 'marketplace'], mobile: ['staff', 'handover', 'marketplace'] }
  return {
    desktop: ['dashboard', 'marketplace', 'sell', 'saved', 'handover', 'activity'],
    mobile: ['dashboard', 'marketplace', 'sell', 'handover', 'activity'],
  }
}

export function SiteHeader() {
  return (
    <>
      <header className="border-line bg-stone/95 supports-[backdrop-filter]:bg-stone/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <Suspense fallback={<HeaderFallback />}>
            <ViewerHeader />
          </Suspense>
        </div>
      </header>
      <Suspense fallback={null}>
        <ViewerTabBar />
      </Suspense>
    </>
  )
}

async function ViewerHeader() {
  const viewer = await getViewer()
  const balance = viewer ? await getWalletBalance() : null
  return <HeaderBody viewer={viewer} balance={balance} />
}

async function ViewerTabBar() {
  const viewer = await getViewer()
  const keys = navFor(viewer).mobile
  return keys.length ? <TabBar keys={keys} /> : null
}

/** Prerendered placeholder: no viewer data and no pathname hook (unknown until request time). */
function HeaderFallback() {
  return (
    <>
      <nav aria-label="Main" className="hidden flex-1 md:block">
        <ul className="flex items-center gap-1">
          <li>
            <Link href="/marketplace" className="text-muted hover:text-ink inline-flex min-h-11 items-center rounded-md px-3 text-[0.95rem] font-medium">
              Marketplace
            </Link>
          </li>
        </ul>
      </nav>
      <div className="ml-auto h-11 w-40" aria-hidden="true" />
    </>
  )
}

function HeaderBody({ viewer, balance }: { viewer: Viewer | null; balance: number | null }) {
  const nav = navFor(viewer)
  return (
    <>
      <nav aria-label="Main" className="hidden flex-1 md:block">
        <NavLinks keys={nav.desktop} />
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {viewer ? (
          <>
            {balance !== null && (
              <Link
                href="/activity#wallet"
                className="border-amber/30 bg-amber-tint hidden min-h-11 items-center gap-2 rounded-full border px-3 text-sm sm:inline-flex"
              >
                <span className="tabular text-ink font-semibold">{formatINR(balance)}</span>
                <span className="text-amber">sandbox</span>
              </Link>
            )}
            <details className="group relative">
              <summary className="border-line bg-chalk flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium [&::-webkit-details-marker]:hidden">
                {viewer.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewer.avatarUrl} alt="" className="size-8 rounded-full object-cover" />
                ) : (
                  <span aria-hidden="true" className="bg-forest text-chalk flex size-8 items-center justify-center rounded-full">
                    {viewer.fullName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="max-w-32 truncate">{viewer.fullName}</span>
                <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
                <span className="sr-only">Account menu</span>
              </summary>
              <div className="rounded-card border-line bg-chalk shadow-ink/5 absolute right-0 mt-2 w-64 border p-2 shadow-lg">
                <div className="px-3 py-2 text-sm">
                  <p className="font-semibold">{viewer.fullName}</p>
                  <p className="text-muted capitalize">
                    {viewer.role}
                    {viewer.hostelName ? `, ${viewer.hostelName}` : ''}
                  </p>
                  {balance !== null && (
                    <p className="mt-1 sm:hidden">
                      Balance <span className="tabular font-semibold">{formatINR(balance)}</span> (sandbox)
                    </p>
                  )}
                </div>
                <Link href="/saved" className="hover:bg-stone flex min-h-11 items-center gap-2 rounded-md px-3 text-sm">
                  <Heart aria-hidden="true" className="size-4" /> Saved items
                </Link>
                <Link href="/settings" className="hover:bg-stone flex min-h-11 items-center gap-2 rounded-md px-3 text-sm">
                  <Settings aria-hidden="true" className="size-4" /> Account settings
                </Link>
                <form action={logout}>
                  <button type="submit" className="hover:bg-stone flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm">
                    <LogOut aria-hidden="true" className="size-4" /> Sign out
                  </button>
                </form>
              </div>
            </details>
          </>
        ) : (
          <>
            <ButtonLink href="/auth/login" variant="ghost" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/auth/signup" size="sm">
              Create account
            </ButtonLink>
          </>
        )}
      </div>
    </>
  )
}
