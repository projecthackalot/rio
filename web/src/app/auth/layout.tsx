import Image from 'next/image'
import { Logo } from '@/components/brand/logo'
import { Leaf, QrCode, TrendingDown } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,36rem)] xl:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <main id="main" tabIndex={-1} className="flex flex-1 items-start justify-center py-10 outline-none sm:items-center">
          {children}
        </main>
      </div>
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-end" aria-label="About RIO">
        <Image
          src="/auth-showcase.jpg"
          alt="University students participating in campus reuse and sustainability marketplace"
          fill
          priority
          sizes="50vw"
          className="object-cover object-center"
        />
        {/* Subtle dual-layer gradient overlay for readability and elegance */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#142b22] via-[#1f4033]/70 to-[#1f4033]/20" />
        <div className="text-chalk relative z-10 space-y-6 p-10 xl:p-14">
          <div className="bg-chalk/15 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-wide backdrop-blur-md">
            <Leaf className="size-3.5 text-emerald-300" />
            <span>Campus Move-Out Circular Economy</span>
          </div>
          <div>
            <p className="font-display text-chalk text-2xl leading-snug font-semibold text-balance xl:text-3xl">
              The cooler you can’t take home is exactly what someone in the next batch needs.
            </p>
            <p className="text-chalk/80 mt-2 text-sm leading-relaxed xl:text-base">
              Hostel essentials move directly from senior to junior. No landfill trips, no price gouging, verified by QR handover.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-chalk/10 border-chalk/15 rounded-lg border p-3 backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
                <TrendingDown className="size-4" />
                <span>Dutch Auction</span>
              </div>
              <p className="text-chalk/75 mt-1 text-xs">Fair daily price drops towards your chosen floor.</p>
            </div>
            <div className="bg-chalk/10 border-chalk/15 rounded-lg border p-3 backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
                <QrCode className="size-4" />
                <span>In-Person QR</span>
              </div>
              <p className="text-chalk/75 mt-1 text-xs">One-time QR scan seals ownership and settles escrow.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
