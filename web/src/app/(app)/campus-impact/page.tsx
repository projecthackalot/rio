import type { Metadata } from 'next'
import { Callout, ContentPage, NextLinks, Section } from '@/components/marketing/content-page'
import { CATEGORIES } from '@/domain/catalog'
import { DEFAULT_RENTAL_SUBSTITUTION_RATE, LOGISTICS_CO2E_PER_TRANSFER_KG } from '@/domain/impact'

export const metadata: Metadata = {
  title: 'Campus impact',
  description: 'How RIO estimates avoided emissions and waste, the assumptions behind the numbers, and what has not been measured yet.',
  alternates: { canonical: '/campus-impact' },
}

export default function CampusImpactPage() {
  const rows = CATEGORIES.filter((c) => c.embodiedCo2eKg > 0)
  return (
    <ContentPage title="Campus impact" lead="What the impact numbers in RIO mean, how they are calculated, and how far you should trust them.">
      <Callout title="These are estimates, not measurements">
        No pilot has been measured yet. Every impact figure in the app comes from the fixed category assumptions on this page, multiplied by completed
        handovers. Treat them as an order-of-magnitude guide.
      </Callout>

      <Section id="method" title="Method">
        <ul>
          <li>
            <strong>Sale or staff transfer:</strong> the item’s estimated embodied carbon (the emissions of making a new one) plus about{' '}
            {LOGISTICS_CO2E_PER_TRANSFER_KG.toFixed(1)} kg CO₂e of avoided transport (8 km at 0.275 kg per km), because the item stays in the building.
          </li>
          <li>
            <strong>Completed rental:</strong> embodied carbon × {DEFAULT_RENTAL_SUBSTITUTION_RATE}. This assumes half of renters would otherwise have bought
            new.
          </li>
          <li>
            <strong>Waste kept out of disposal:</strong> the item’s typical weight, counted once when it is sold or handed to staff.
          </li>
          <li>Items in the “Other” category have no assumption, so they add nothing to the totals.</li>
        </ul>
      </Section>

      <Section id="factors" title="Category assumptions">
        <div className="overflow-x-auto" role="region" aria-label="Category assumptions table (scrollable)" tabIndex={0}>
          <table className="w-full min-w-[30rem] text-left text-sm">
            <caption className="sr-only">Assumed embodied carbon, weight and volume per category</caption>
            <thead>
              <tr className="border-line text-muted border-b">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Category
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Embodied CO₂e
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Weight
                </th>
                <th scope="col" className="py-2 font-medium">
                  Volume
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.slug} className="border-line border-b">
                  <th scope="row" className="py-2 pr-4 font-medium">
                    {c.name}
                  </th>
                  <td className="tabular py-2 pr-4">{c.embodiedCo2eKg} kg</td>
                  <td className="tabular py-2 pr-4">{c.tareKg} kg</td>
                  <td className="tabular py-2">{c.volumeM3} m³</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted text-sm">
          Values were set in the original prototype from published embodied-carbon ranges for similar products. They are not specific to any brand or model.
        </p>
      </Section>

      <Section id="limits" title="What the estimates leave out">
        <ul>
          <li>Whether the buyer would really have bought new, and whether the item lasts as long as a new one.</li>
          <li>The age and efficiency of the specific item, especially for electrical goods.</li>
          <li>Any real disposal data from the campus. That needs a measured pilot with the waste-management team.</li>
        </ul>
      </Section>

      <NextLinks
        links={[
          { href: '/about', label: 'About RIO' },
          { href: '/how-it-works', label: 'How it works' },
        ]}
      />
    </ContentPage>
  )
}
