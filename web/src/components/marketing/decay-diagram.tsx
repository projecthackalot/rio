/**
 * Worked example of the Dutch-auction rule (not live data): an air cooler
 * listed 2 days before departure at ₹1,800 with a ₹500 floor. Coordinates are
 * derived from the real rule: linear decay ends 2h before departure; the last
 * hour belongs to campus staff.
 */
export function DecayDiagram() {
  // Chart area: x 40→460 spans 48h; y 30 (₹1,800) → 190 (₹500).
  const x = (h: number) => 40 + (h / 48) * 420
  const y = (rupees: number) => 30 + ((1800 - rupees) / 1300) * 160
  const floorX = x(46)
  const staffX = x(47)
  const depX = x(48)

  return (
    <figure className="rounded-card border-line bg-chalk border p-5 sm:p-6">
      <figcaption className="mb-4">
        <p className="font-display text-lg font-semibold">How a price falls</p>
        <p className="text-muted text-sm">Example: an air cooler listed two days before its owner leaves.</p>
      </figcaption>
      <svg viewBox="0 0 500 240" role="img" aria-labelledby="decay-title decay-desc" className="w-full">
        <title id="decay-title">Example price over two days</title>
        <desc id="decay-desc">
          The price starts at ₹1,800 and falls in a straight line to the ₹500 floor two hours before departure. It stays at the floor until the final hour, when
          unsold items go to campus staff.
        </desc>
        <g stroke="var(--color-line)" strokeWidth="1">
          <line x1="40" y1="190" x2="470" y2="190" />
          <line x1="40" y1="30" x2="40" y2="190" />
        </g>
        <g fill="var(--color-muted)" fontSize="12" fontFamily="var(--font-sans)">
          <text x="36" y="34" textAnchor="end">
            ₹1,800
          </text>
          <text x="36" y="194" textAnchor="end">
            ₹500
          </text>
          <text x="40" y="212">
            Listed
          </text>
          <text x={x(24)} y="212" textAnchor="middle">
            24 hours
          </text>
          <text x={depX} y="212" textAnchor="end">
            Departure
          </text>
        </g>
        {/* Final hour band */}
        <rect x={staffX} y="24" width={depX - staffX + 2} height="166" fill="var(--color-clay-tint)" />
        <line x1={x(0)} y1={y(1800)} x2={floorX} y2={y(500)} stroke="var(--color-forest)" strokeWidth="3" strokeLinecap="round" />
        <line x1={floorX} y1={y(500)} x2={staffX} y2={y(500)} stroke="var(--color-forest)" strokeWidth="3" />
        <line x1={staffX} y1={y(500)} x2={depX} y2={y(500)} stroke="var(--color-clay)" strokeWidth="3" strokeDasharray="4 4" />
        <circle r="7" fill="var(--color-clay)" stroke="var(--color-chalk)" strokeWidth="3" className="rio-decay-dot" cx={x(0)} cy={y(1800)}>
          <animate attributeName="cx" values={`${x(0)};${floorX};${floorX}`} keyTimes="0;0.85;1" dur="3.2s" fill="freeze" begin="0.4s" />
          <animate attributeName="cy" values={`${y(1800)};${y(500)};${y(500)}`} keyTimes="0;0.85;1" dur="3.2s" fill="freeze" begin="0.4s" />
        </circle>
        <g fontSize="12" fontFamily="var(--font-sans)">
          <text x={x(23) + 10} y={y(1150) - 10} fill="var(--color-ink)">
            ₹1,150 halfway
          </text>
          <text x={staffX - 6} y="44" textAnchor="end" fill="var(--color-clay)">
            Final hour: staff
          </text>
        </g>
      </svg>
      <style>{`@media (prefers-reduced-motion: reduce){.rio-decay-dot animate{display:none}}`}</style>
    </figure>
  )
}
