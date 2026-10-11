import { SiteFooter } from '@/components/shell/site-footer'
import { SiteHeader } from '@/components/shell/site-header'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto min-h-[70dvh] max-w-6xl px-4 pt-6 pb-16 outline-none sm:px-6 md:pt-10">
        {children}
      </main>
      <SiteFooter />
    </>
  )
}
