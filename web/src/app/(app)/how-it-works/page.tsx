import type { Metadata } from 'next'
import { Callout, ContentPage, NextLinks, Section } from '@/components/marketing/content-page'
import { DecayDiagram } from '@/components/marketing/decay-diagram'
import { DAMAGE_DEDUCTION_BPS, DEPOSIT_BPS, RENTAL_PERIODS, RENT_TO_OWN_CREDIT_BPS } from '@/domain/rental'

export const metadata: Metadata = {
  title: 'How it works',
  description: 'How selling, buying and renting work on RIO: the falling price, the claim, the QR handover and what happens to unsold items.',
  alternates: { canonical: '/how-it-works' },
}

const pct = (bps: number) => `${bps / 100}%`

export default function HowItWorksPage() {
  return (
    <ContentPage title="How RIO works" lead="The item stays in the room. Only the owner changes. Here is each path, step by step.">
      <DecayDiagram />

      <Section id="selling" title="Selling something you can’t take home">
        <ol>
          <li>List the item with a photo, its condition, a starting price, the lowest price you’d accept (your floor) and the day you leave.</li>
          <li>
            The price falls in a straight line from the starting price to your floor, and reaches the floor two hours before you leave. It never goes below it.
          </li>
          <li>When a student claims it, the money is held in escrow. You arrange a time to meet; your room number is never shown on the listing.</li>
          <li>You show a one-time code, the buyer scans it once they have the item, and the payment is released to you.</li>
        </ol>
      </Section>

      <Section id="buying" title="Buying">
        <ol>
          <li>Browse or search without an account. Every listing shows today’s price, the floor and when the owner leaves.</li>
          <li>Sign in and claim. The exact price is fixed by the server at that moment, so what you confirm is what you pay.</li>
          <li>Meet the seller, check the item, then scan their code. You can cancel any time before scanning for a full refund.</li>
          <li>You can hold one purchase per category at a time, so one person can’t collect every cooler on campus.</li>
        </ol>
      </Section>

      <Section id="renting" title="Renting and rent-to-own">
        <ul>
          <li>
            Rent is {pct(RENTAL_PERIODS.DAY.bps)} of the starting price for a day, {pct(RENTAL_PERIODS.WEEK.bps)} for a week and {pct(RENTAL_PERIODS.MONTH.bps)}{' '}
            for a month, plus a refundable deposit of {pct(DEPOSIT_BPS)}.
          </li>
          <li>The item must come back at least 24 hours before its owner leaves, so longer rentals close first.</li>
          <li>Pickup and return are each confirmed with a code. A clean return refunds the whole deposit.</li>
          <li>
            Want to keep it? {pct(RENT_TO_OWN_CREDIT_BPS)} of the rent you paid comes off the current price, never below the owner’s floor, and your deposit is
            refunded.
          </li>
          <li>If the owner reports damage, a warden decides. The most that can be deducted is {pct(DAMAGE_DEDUCTION_BPS)} of the deposit.</li>
        </ul>
      </Section>

      <Section id="final-hour" title="The final hour">
        <p>
          In the last hour before an owner leaves, claims and rentals close. The hostel’s warden can route anything unsold to campus staff, who take custody
          with the same code scan. Nothing is left in a corridor.
        </p>
      </Section>

      <Callout title="Simulated payment: no real money is transferred">
        RIO is in a Level 1 pilot. Balances, escrow, payouts, deposits and refunds are sandbox entries in a ledger. Real payments are a later, separate project.
      </Callout>

      <NextLinks
        links={[
          { href: '/marketplace', label: 'Browse the marketplace' },
          { href: '/trust-and-safety', label: 'Trust and safety' },
          { href: '/help', label: 'Help and FAQ' },
        ]}
      />
    </ContentPage>
  )
}
