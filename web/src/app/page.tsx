import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { QrCode, Repeat, ShieldCheck, Users } from 'lucide-react'
import { DecayDiagram } from '@/components/marketing/decay-diagram'
import { CategoryShortcuts, HomeSearch, LeavingSoon } from '@/components/marketing/home-sections'
import { SiteFooter } from '@/components/shell/site-footer'
import { SiteHeader } from '@/components/shell/site-header'
import { buttonClass } from '@/components/ui/button'
import { CATEGORIES } from '@/domain/catalog'
import { LOGISTICS_CO2E_PER_TRANSFER_KG } from '@/domain/impact'
import { formatINR } from '@/domain/money'
import { RENTAL_PERIODS, DEPOSIT_BPS, DAMAGE_DEDUCTION_BPS, RENT_TO_OWN_CREDIT_BPS } from '@/domain/rental'

export const metadata: Metadata = { alternates: { canonical: '/' } }

const STEPS = [
  {
    title: 'List it where it stands',
    body: 'Photograph the cooler, mattress or drafter in your room. Set a starting price, the lowest price you’d accept, and the day you leave.',
  },
  {
    title: 'The price walks down',
    body: 'The price falls steadily towards your floor and reaches it two hours before you leave. Buyers see the floor and the deadline up front.',
  },
  {
    title: 'Claim, then meet',
    body: 'A buyer claims the item and the money waits in sandbox escrow. Your exact room is never shown publicly; you arrange the handover yourselves.',
  },
  {
    title: 'Scan to finish',
    body: 'You show a one-time QR code, the buyer scans it, and the sale settles. Codes expire in 10 minutes and work once.',
  },
  {
    title: 'Nothing gets dumped',
    body: 'In your final hour, anything unsold is routed to campus staff by your warden, and they take custody with the same QR handover.',
  },
]

const pct = (bps: number) => `${bps / 100}%`

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24">
          <div>
            <h1 className="text-[clamp(2.4rem,9vw,4.5rem)] leading-[1.02] font-bold">Leaving campus? Leave your stuff for the next batch.</h1>
            <p className="text-muted mt-6 max-w-xl text-lg sm:text-xl">
              RIO is a move-out marketplace for hostels. Sell or rent what you can’t carry home, at a price that drops as your departure nears, and hand it over
              with a QR scan.
            </p>
            <div className="mt-8">
              <HomeSearch />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/marketplace" className={buttonClass('secondary', 'lg')}>
                Browse all items
              </Link>
              <Link href="/sell/new" className={buttonClass('ghost', 'lg')}>
                List an item
              </Link>
            </div>
            <p className="text-muted mt-5 text-sm">Simulated payment: no real money is transferred during the pilot.</p>
          </div>
          <DecayDiagram />
        </section>

        <CategoryShortcuts />
        <Suspense fallback={null}>
          <LeavingSoon />
        </Suspense>

        <section id="how-it-works" aria-labelledby="how-heading" className="border-line bg-chalk border-y">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="how-heading" className="max-w-2xl text-4xl">
              How a handover works
            </h2>
            <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <span aria-hidden="true" className="font-display text-forest text-5xl font-bold">
                    {i + 1}
                  </span>
                  <h3 className="mt-2 text-xl">{s.title}</h3>
                  <p className="text-muted mt-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="rules" aria-labelledby="rules-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 id="rules-heading" className="text-4xl">
                The rules, in numbers
              </h2>
              <p className="text-muted mt-4 max-w-lg">
                No hidden maths. These are the exact rules the app and the database use. Every amount is rounded to the rupee and shown before you commit.
              </p>
              <dl className="divide-line border-line mt-8 divide-y border-y">
                {(Object.keys(RENTAL_PERIODS) as (keyof typeof RENTAL_PERIODS)[]).map((k) => (
                  <Rule key={k} term={`Rent for a ${RENTAL_PERIODS[k].label.toLowerCase()}`} value={`${pct(RENTAL_PERIODS[k].bps)} of the starting price`} />
                ))}
                <Rule term="Refundable deposit" value={`${pct(DEPOSIT_BPS)} of the starting price`} />
                <Rule term="Rent-to-own credit" value={`${pct(RENT_TO_OWN_CREDIT_BPS)} of rent paid, never below the floor`} />
                <Rule term="Damage deduction" value={`${pct(DAMAGE_DEDUCTION_BPS)} of the deposit, decided by a warden`} />
                <Rule term="Price rounding" value="Nearest ₹5, never below your floor" />
              </dl>
            </div>
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <Feature icon={<ShieldCheck aria-hidden="true" className="size-5" />} title="Room numbers stay private">
                Only you and your hostel’s warden can see your block and room.
              </Feature>
              <Feature icon={<QrCode aria-hidden="true" className="size-5" />} title="Single-use QR codes">
                Checked by the server, valid for 10 minutes, and useless once scanned.
              </Feature>
              <Feature icon={<Repeat aria-hidden="true" className="size-5" />} title="Rent first, buy later">
                Half of what you paid in rent comes off the price if you decide to keep it.
              </Feature>
              <Feature icon={<Users aria-hidden="true" className="size-5" />} title="Wardens settle disputes">
                A warden from your hostel, who isn’t involved, decides refunds and damage claims.
              </Feature>
            </div>
          </div>
        </section>

        <section aria-labelledby="impact-heading" className="border-line bg-forest text-chalk border-t">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="impact-heading" className="text-chalk max-w-2xl text-4xl">
              What a handover is estimated to save
            </h2>
            <p className="text-chalk/85 mt-4 max-w-2xl">
              Estimates, not measurements: embodied carbon for each category plus about {LOGISTICS_CO2E_PER_TRANSFER_KG.toFixed(1)} kg of avoided transport when
              an item changes hands in place.
            </p>
            <div className="mt-8 overflow-x-auto" role="region" aria-label="Impact estimates table (scrollable)" tabIndex={0}>
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Estimated impact per item by category</caption>
                <thead>
                  <tr className="border-chalk/25 text-chalk/80 border-b">
                    <th scope="col" className="py-3 pr-4 font-medium">
                      Category
                    </th>
                    <th scope="col" className="py-3 pr-4 font-medium">
                      CO₂e avoided (est.)
                    </th>
                    <th scope="col" className="py-3 pr-4 font-medium">
                      Kept out of waste
                    </th>
                    <th scope="col" className="py-3 font-medium">
                      Typical starting price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.filter((c) => c.embodiedCo2eKg > 0).map((c) => (
                    <tr key={c.slug} className="border-chalk/15 border-b">
                      <th scope="row" className="py-3 pr-4 font-medium">
                        {c.name}
                      </th>
                      <td className="tabular py-3 pr-4">{(c.embodiedCo2eKg + LOGISTICS_CO2E_PER_TRANSFER_KG).toFixed(1)} kg</td>
                      <td className="tabular py-3 pr-4">{c.tareKg} kg</td>
                      <td className="tabular py-3">{formatINR(c.defaultStartPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link href="/auth/signup" className={`${buttonClass('secondary', 'lg')} border-chalk bg-chalk mt-10`}>
              Create a student account
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

function Rule({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3">
      <dt className="font-medium">{term}</dt>
      <dd className="text-muted">{value}</dd>
    </div>
  )
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border-line bg-chalk border p-5">
      <div className="bg-forest-tint text-forest flex size-10 items-center justify-center rounded-full">{icon}</div>
      <h3 className="mt-4 text-lg">{title}</h3>
      <p className="text-muted mt-1 text-sm">{children}</p>
    </div>
  )
}
