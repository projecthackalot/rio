import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentPage, Faq, NextLinks, Section } from '@/components/marketing/content-page'

export const metadata: Metadata = {
  title: 'Help and FAQ',
  description: 'Answers about listing, prices, claims, rentals, deposits, handover codes, disputes and your account on RIO.',
  alternates: { canonical: '/help' },
}

export default function HelpPage() {
  return (
    <ContentPage title="Help and FAQ" lead="Short answers to the questions people ask most.">
      <Section id="prices" title="Listings and prices">
        <Faq
          items={[
            {
              q: 'Why did the price change since I last looked?',
              a: (
                <p>
                  Prices fall steadily from the starting price to the seller’s floor as their departure approaches. Each page shows the time the price was
                  calculated.
                </p>
              ),
            },
            {
              q: 'What price will I actually pay?',
              a: (
                <p>
                  The price at the moment you confirm the claim, calculated by the server and rounded to the nearest ₹5. It is never below the seller’s floor.
                </p>
              ),
            },
            {
              q: 'Can I change my price after listing?',
              a: <p>Yes, while the item is not in a transaction. Changing the starting price, floor or departure restarts the price decline from now.</p>,
            },
            {
              q: 'Why does my listing say “Final hour”?',
              a: <p>You leave within the hour, so claims and rentals are closed and your warden can route the item to campus staff.</p>,
            },
          ]}
        />
      </Section>

      <Section id="claims" title="Claims and handover">
        <Faq
          items={[
            {
              q: 'I claimed an item. What now?',
              a: (
                <p>
                  Arrange to meet the seller. When you have checked the item, open <Link href="/handover">Handover</Link> and scan the code on their phone, or
                  type the 16 characters shown under it.
                </p>
              ),
            },
            {
              q: 'The code says expired or already used.',
              a: <p>Codes last 10 minutes and work once. Ask the other person to tap “New code” and scan the fresh one.</p>,
            },
            { q: 'My camera won’t open.', a: <p>Allow camera access for the site in your browser settings, or type the code instead. Typing always works.</p> },
            {
              q: 'Why can’t I claim a second item in the same category?',
              a: <p>To stop hoarding, each student can hold one purchase per category. The “Other” category is exempt.</p>,
            },
          ]}
        />
      </Section>

      <Section id="rentals" title="Rentals and deposits">
        <Faq
          items={[
            { q: 'When do I get my deposit back?', a: <p>As soon as the owner scans your return code and does not report damage.</p> },
            {
              q: 'The owner reported damage. What happens?',
              a: <p>The deposit stays held and a warden reviews it. They can refund it in full or deduct up to 25% for the owner.</p>,
            },
            {
              q: 'Why is the monthly option greyed out?',
              a: <p>The item has to be back at least 24 hours before the owner leaves, and a month would run past that.</p>,
            },
            {
              q: 'How does rent-to-own work?',
              a: (
                <p>
                  While renting, you can buy the item. Half of the rent you paid comes off the current price, never below the floor, and your deposit is
                  refunded.
                </p>
              ),
            },
          ]}
        />
      </Section>

      <Section id="account" title="Account and money">
        <Faq
          items={[
            {
              q: 'Is the money real?',
              a: <p>No. This is a pilot with simulated payment: no real money is transferred. New accounts start with ₹3,000 of sandbox credit.</p>,
            },
            {
              q: 'How do I become a warden or staff member?',
              a: <p>A campus administrator assigns those roles. Everyone who signs up starts as a student.</p>,
            },
            {
              q: 'I didn’t get the confirmation email.',
              a: (
                <p>
                  Check spam, then try <Link href="/auth/magic-link">signing in by email link</Link> or{' '}
                  <Link href="/auth/forgot-password">resetting your password</Link>.
                </p>
              ),
            },
            {
              q: 'How do I change my hostel or room?',
              a: (
                <p>
                  In <Link href="/settings">Account settings</Link>. Room details are visible only to you and your hostel’s warden.
                </p>
              ),
            },
          ]}
        />
      </Section>

      <NextLinks
        links={[
          { href: '/how-it-works', label: 'How it works' },
          { href: '/trust-and-safety', label: 'Trust and safety' },
          { href: '/contact', label: 'Contact' },
        ]}
      />
    </ContentPage>
  )
}
