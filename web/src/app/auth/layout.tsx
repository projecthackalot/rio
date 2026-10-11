import { Logo } from '@/components/brand/logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,34rem)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <main id="main" tabIndex={-1} className="flex flex-1 items-start justify-center py-10 outline-none sm:items-center">
          {children}
        </main>
      </div>
      <aside className="bg-forest text-chalk hidden p-12 lg:flex lg:flex-col lg:justify-end" aria-label="About RIO">
        <p className="font-display text-chalk text-3xl leading-tight font-semibold">
          The cooler you can’t take home is exactly what someone in the next batch needs.
        </p>
        <p className="text-chalk/85 mt-4">Hostel move-out, without the dumpster run. Payments in this pilot are sandbox only.</p>
      </aside>
    </div>
  )
}
