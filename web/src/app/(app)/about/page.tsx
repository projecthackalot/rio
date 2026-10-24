import type { Metadata } from 'next'
import { ContentPage, NextLinks, Section } from '@/components/marketing/content-page'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'About',
  description: 'Why RIO exists: the hostel move-out problem, the in-room handover idea and where the project is today.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <ContentPage title="About RIO" lead="A student project about one specific week of the year: the one when everybody moves out.">
      <Section id="problem" title="The problem">
        <p>
          At the end of a hostel stay, students own things that are useful on campus and awkward everywhere else: an air cooler, a mattress, a kettle, a
          drafter, a study table. Carrying them home costs more than they are worth, so they are sold in a hurry, abandoned or thrown away. A few weeks later
          the next batch arrives and buys the same things new.
        </p>
      </Section>

      <Section id="idea" title="The idea">
        <p>
          RIO stands for circular asset handover. The item does not travel; ownership does. A leaving student lists what they have, the price falls as their
          departure gets closer, and a student who is staying or arriving takes it over in the same building.
        </p>
        <ul>
          <li>A falling price with a visible floor replaces last-minute haggling.</li>
          <li>Renting covers short stays and lets people try before they buy.</li>
          <li>A one-time code confirms each handover, so payment follows the item.</li>
          <li>Whatever is unsold in the final hour goes to campus staff through the hostel’s warden.</li>
        </ul>
      </Section>

      <Section id="status" title="Where the project is">
        <p>
          RIO began as a Streamlit prototype that modelled the pricing and handover rules. This web app is the {SITE.pilot}: real accounts, a real database and
          the full buy, rent, handover, dispute and staff workflows, with simulated payments. It is built first for one campus and designed so that more hostels
          and campuses can be added later.
        </p>
        <p>It is not yet connected to university systems, and it does not process real money.</p>
      </Section>

      <Section id="open" title="Open source">
        <p>
          The code is public at <a href={SITE.repoUrl}>github.com/projecthackalot/rio</a>. Bug reports and suggestions are welcome there.
        </p>
      </Section>

      <NextLinks
        links={[
          { href: '/how-it-works', label: 'How it works' },
          { href: '/campus-impact', label: 'Campus impact' },
          { href: '/contact', label: 'Contact' },
        ]}
      />
    </ContentPage>
  )
}
