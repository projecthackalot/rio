'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftRight, CircleHelp, ClipboardList, Gavel, Heart, LayoutDashboard, PlusCircle, Route, ScanLine, ShieldCheck, Store, Users } from 'lucide-react'
import { cn } from '@/lib/cn'

export type NavKey =
  'howItWorks' | 'help' | 'saved' | 'marketplace' | 'dashboard' | 'sell' | 'handover' | 'activity' | 'disputes' | 'warden' | 'staff' | 'admin'

const ITEMS: Record<NavKey, { href: string; label: string; Icon: typeof Store }> = {
  marketplace: { href: '/marketplace', label: 'Marketplace', Icon: Store },
  howItWorks: { href: '/how-it-works', label: 'How it works', Icon: Route },
  help: { href: '/help', label: 'Help', Icon: CircleHelp },
  saved: { href: '/saved', label: 'Saved', Icon: Heart },
  dashboard: { href: '/dashboard', label: 'Home', Icon: LayoutDashboard },
  sell: { href: '/sell/new', label: 'Sell', Icon: PlusCircle },
  handover: { href: '/handover', label: 'Handover', Icon: ScanLine },
  activity: { href: '/activity', label: 'Activity', Icon: ArrowLeftRight },
  disputes: { href: '/disputes', label: 'Disputes', Icon: Gavel },
  warden: { href: '/warden', label: 'Warden', Icon: ShieldCheck },
  staff: { href: '/staff', label: 'Staff', Icon: Users },
  admin: { href: '/admin/roles', label: 'Roles', Icon: ClipboardList },
}

function isActive(pathname: string, href: string) {
  const root = href.split('/').slice(0, 2).join('/')
  return pathname === href || pathname.startsWith(`${root}/`) || pathname === root
}

export function NavLinks({ keys, className }: { keys: NavKey[]; className?: string }) {
  const pathname = usePathname()
  return (
    <ul className={cn('flex items-center gap-1', className)}>
      {keys.map((k) => {
        const { href, label } = ITEMS[k]
        const active = isActive(pathname, href)
        return (
          <li key={k}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'text-muted hover:text-ink inline-flex min-h-11 items-center rounded-md px-3 text-[0.95rem] font-medium',
                active && 'text-forest underline decoration-2 underline-offset-[10px]',
              )}
            >
              {label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Phone navigation: fixed bottom bar with icon + label for each destination. */
export function TabBar({ keys }: { keys: NavKey[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Primary" className="border-line bg-chalk fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${keys.length}, minmax(0, 1fr))` }}>
        {keys.map((k) => {
          const { href, label, Icon } = ITEMS[k]
          const active = isActive(pathname, href)
          return (
            <li key={k}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn('text-muted flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium', active && 'text-forest')}
              >
                <Icon aria-hidden="true" className={cn('size-5', active && 'stroke-[2.5]')} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
