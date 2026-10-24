import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentPage, NextLinks, Section } from '@/components/marketing/content-page'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Where to get help with a RIO transaction, report a bug or reach the project team.',
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <ContentPage title="Contact" lead="The fastest route depends on what you need.">
      <Section id="transaction" title="A problem with a purchase or rental">
        <p>
          Use “Report a problem” on the transaction in <Link href="/activity">My activity</Link>. That pauses it and sends it to a warden for your hostel, who
          can see the details and decide. This is quicker and safer than contacting anyone directly.
        </p>
      </Section>

      <Section id="account" title="Your account or role">
        <p>
          Sign-in trouble is covered in <Link href="/help#account">Help</Link>. Warden and staff access is assigned by your campus administrator; ask your
          hostel office.
        </p>
      </Section>

      <Section id="project" title="Bugs, ideas and the project team">
        <p>
          RIO is developed in the open. Report bugs or suggest improvements on the project’s <a href={SITE.issuesUrl}>GitHub issue tracker</a>. Please don’t
          include personal details such as room numbers or phone numbers in a public issue.
        </p>
        <p className="text-muted text-sm">
          The pilot does not yet have a staffed support desk, phone line or support email. This page will list them when they exist.
        </p>
      </Section>

      <NextLinks
        links={[
          { href: '/help', label: 'Help and FAQ' },
          { href: '/trust-and-safety', label: 'Trust and safety' },
        ]}
      />
    </ContentPage>
  )
}
