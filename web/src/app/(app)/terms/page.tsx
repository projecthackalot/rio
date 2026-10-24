import type { Metadata } from 'next'
import Link from 'next/link'
import { Callout, ContentPage, NextLinks, Section } from '@/components/marketing/content-page'
import { DAMAGE_DEDUCTION_BPS, DEPOSIT_BPS, RENTAL_PERIODS, RENT_TO_OWN_CREDIT_BPS } from '@/domain/rental'

export const metadata: Metadata = {
  title: 'Terms and listing policy',
  description: 'The rules for using RIO during the pilot: accounts, listings, claims, rentals, deposits, disputes and simulated payments.',
  alternates: { canonical: '/terms' },
}

const pct = (bps: number) => `${bps / 100}%`

export default function TermsPage() {
  return (
    <ContentPage title="Terms and listing policy" lead="The rules everyone agrees to when using RIO during the pilot." updated="12 October 2026">
      <Callout title="Pilot terms">
        These are the working rules built into the software for a student pilot. They are not a reviewed legal agreement, and the rental and damage figures are
        proposals that the campus running a pilot must confirm before they are treated as policy.
      </Callout>

      <Section id="payments" title="1. Payments are simulated">
        <p>
          No real money is transferred. Balances, escrow, payouts, deposits, refunds and deductions are sandbox ledger entries with no cash value. Do not
          exchange real money on the strength of a RIO balance.
        </p>
      </Section>

      <Section id="accounts" title="2. Accounts">
        <ul>
          <li>One account per person, with your real name. Every new account is a student account.</li>
          <li>Warden, staff and administrator access is granted only by a campus administrator.</li>
          <li>Keep your sign-in details to yourself; you are responsible for what is done with your account.</li>
        </ul>
      </Section>

      <Section id="listings" title="3. Listings">
        <ul>
          <li>
            List only items you own and may keep in your room. See the list of what is not allowed on the{' '}
            <Link href="/trust-and-safety#allowed">Trust and safety</Link> page.
          </li>
          <li>Describe the item and its condition honestly, with photos of the actual item.</li>
          <li>You set a starting price and a floor. The price falls to the floor two hours before your departure and is rounded to the nearest ₹5.</li>
          <li>In your final hour, unsold items may be routed to campus staff by your warden.</li>
        </ul>
      </Section>

      <Section id="claims" title="4. Claims and handover">
        <ul>
          <li>A claim reserves the item and holds the price at that moment in escrow.</li>
          <li>Either person may cancel before handover; the buyer is refunded in full.</li>
          <li>
            Scanning the seller’s code confirms you have received the item and releases the payment. This cannot be undone except through a dispute opened
            before the scan.
          </li>
          <li>Each student may hold one purchase per category.</li>
        </ul>
      </Section>

      <Section id="rentals" title="5. Rentals (proposed terms)">
        <ul>
          <li>
            Rent: {pct(RENTAL_PERIODS.DAY.bps)} of the starting price per day, {pct(RENTAL_PERIODS.WEEK.bps)} per week, {pct(RENTAL_PERIODS.MONTH.bps)} per
            month. Deposit: {pct(DEPOSIT_BPS)} of the starting price.
          </li>
          <li>The item must be returned at least 24 hours before the owner’s departure.</li>
          <li>The deposit is refunded on return unless the owner reports damage, in which case a warden decides.</li>
          <li>The maximum damage deduction is {pct(DAMAGE_DEDUCTION_BPS)} of the deposit.</li>
          <li>Rent-to-own: {pct(RENT_TO_OWN_CREDIT_BPS)} of rent paid is credited against the current price, never below the floor.</li>
        </ul>
      </Section>

      <Section id="disputes" title="6. Disputes">
        <p>
          Disputes are decided by a warden assigned to the item’s hostel who is not a party to the transaction. Their decision settles the sandbox amounts for
          that transaction.
        </p>
      </Section>

      <Section id="conduct" title="7. Conduct">
        <p>
          Do not misuse other people’s details, harass anyone, list prohibited items, or try to get around the handover codes or role restrictions. Accounts
          that do can be restricted by an administrator.
        </p>
      </Section>

      <Section id="pilot" title="8. A pilot, provided as is">
        <p>RIO is a student project under active development. Features may change, and the service may be unavailable or reset during the pilot.</p>
      </Section>

      <NextLinks
        links={[
          { href: '/privacy', label: 'Privacy' },
          { href: '/trust-and-safety', label: 'Trust and safety' },
          { href: '/help', label: 'Help and FAQ' },
        ]}
      />
    </ContentPage>
  )
}
