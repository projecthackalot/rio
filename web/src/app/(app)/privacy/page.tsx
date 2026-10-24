import type { Metadata } from 'next'
import Link from 'next/link'
import { Callout, ContentPage, NextLinks, Section } from '@/components/marketing/content-page'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What information RIO stores during the pilot, who can see it and how it is protected.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy" lead="What RIO stores, who can see it, and what it is used for during the pilot." updated="12 October 2026">
      <Callout title="Pilot notice">
        This page describes how the software actually handles data. It is a plain-language notice for a student pilot and has not been reviewed as a legal
        privacy policy. The campus running a pilot is responsible for its own formal policy.
      </Callout>

      <Section id="collect" title="What RIO stores">
        <ul>
          <li>
            <strong>Account:</strong> your email address and sign-in details, handled by Supabase Auth. If you sign in with Google, RIO receives your name and
            email from Google. RIO never sees or stores your password in readable form.
          </li>
          <li>
            <strong>Profile:</strong> your name, hostel and role.
          </li>
          <li>
            <strong>Private details you choose to add:</strong> block, room, phone number and planned departure.
          </li>
          <li>
            <strong>Activity:</strong> your listings and photos, claims, rentals, handover records, disputes and any evidence you upload, and your sandbox
            ledger.
          </li>
          <li>
            <strong>Audit records:</strong> who performed role changes and transaction steps, and when.
          </li>
        </ul>
      </Section>

      <Section id="see" title="Who can see what">
        <ul>
          <li>
            <strong>Anyone, signed in or not:</strong> active listings (title, description, photos, condition, prices, hostel name and departure time).
          </li>
          <li>
            <strong>Signed-in members:</strong> the names and hostels of other members, needed to arrange handovers.
          </li>
          <li>
            <strong>Only you and wardens of your hostel:</strong> your block, room, phone and planned departure.
          </li>
          <li>
            <strong>Only you:</strong> your sandbox balance and ledger.
          </li>
          <li>
            <strong>Only the people in a transaction and wardens of that hostel:</strong> its details, disputes and evidence files.
          </li>
        </ul>
        <p>These rules are enforced in the database itself, not only in the screens you see.</p>
      </Section>

      <Section id="use" title="What it is used for">
        <p>
          Only to run the marketplace: showing listings, completing handovers, resolving disputes and letting wardens manage move-out. RIO does not sell data,
          show adverts or run analytics trackers.
        </p>
      </Section>

      <Section id="where" title="Where it is kept">
        <p>
          Data is stored in the Supabase project configured by whoever operates the pilot. Listing photos are publicly reachable by their link; dispute evidence
          is private and opened through links that expire after five minutes. The app sets only the cookies needed to keep you signed in.
        </p>
      </Section>

      <Section id="choices" title="Your choices">
        <ul>
          <li>
            Edit your name, hostel and private details in <Link href="/settings">Account settings</Link>; clear a field to remove it.
          </li>
          <li>Withdraw a listing at any time before it is in a transaction.</li>
          <li>
            Self-service account deletion is not built yet. To have an account removed during the pilot, ask the campus administrator running it or use the{' '}
            <Link href="/contact">contact page</Link>.
          </li>
        </ul>
      </Section>

      <NextLinks
        links={[
          { href: '/terms', label: 'Terms' },
          { href: '/trust-and-safety', label: 'Trust and safety' },
        ]}
      />
    </ContentPage>
  )
}
