import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentPage, NextLinks, Section } from '@/components/marketing/content-page'

export const metadata: Metadata = {
  title: 'Accessibility',
  description: 'How RIO is built for keyboard, screen-reader and low-vision use, what has been tested and what has not.',
  alternates: { canonical: '/accessibility' },
}

export default function AccessibilityPage() {
  return (
    <ContentPage title="Accessibility" lead="RIO aims to meet WCAG 2.2 level AA. Here is what that means in practice, and where it has not been verified.">
      <Section id="built" title="What is built in">
        <ul>
          <li>Every action works with a keyboard, with a visible focus outline and a “Skip to content” link.</li>
          <li>Forms have visible labels, and errors are written next to the field and announced.</li>
          <li>Status is always shown as text with an icon, never by colour alone. Text contrast is at least 4.5:1.</li>
          <li>Buttons and links are at least 44 pixels tall on touch screens.</li>
          <li>Handover never requires a camera: the code can always be typed.</li>
          <li>Animations are switched off when your device asks for reduced motion.</li>
          <li>Pages reflow from 320 pixels wide without sideways scrolling; wide tables scroll inside their own labelled area.</li>
        </ul>
      </Section>

      <Section id="tested" title="What has been tested">
        <p>
          The public pages and sign-in screens are checked automatically with the axe engine at phone and desktop sizes on every test run, including for
          sideways overflow at 320 and 360 pixels wide.
        </p>
      </Section>

      <Section id="not-tested" title="What has not been verified">
        <ul>
          <li>No manual audit with a screen reader (NVDA, JAWS, VoiceOver or TalkBack) has been done yet.</li>
          <li>Signed-in pages are covered by automated checks only when the full test journey is run against a seeded database.</li>
          <li>Camera scanning has not been tried with assistive technology on physical devices.</li>
        </ul>
        <p>Automated checks find only some accessibility problems, so passing them is not a claim of full conformance.</p>
      </Section>

      <Section id="report" title="Tell us about a barrier">
        <p>
          If something is hard or impossible to use, please report it through the <Link href="/contact">contact page</Link> with the page and what you were
          trying to do.
        </p>
      </Section>

      <NextLinks
        links={[
          { href: '/help', label: 'Help and FAQ' },
          { href: '/contact', label: 'Contact' },
        ]}
      />
    </ContentPage>
  )
}
