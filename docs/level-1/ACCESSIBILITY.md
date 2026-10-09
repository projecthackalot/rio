# Accessibility Strategy

## Target Standard
WCAG 2.2 Level AA.

## Implementation Guidelines
1. **Semantic HTML**: Use proper heading hierarchy (`<h1>` to `<h6>`), landmarks (`<main>`, `<nav>`, `<aside>`), and semantic tags (`<button>`, `<a>`, `<dialog>`).
2. **Keyboard Navigation**: Every interactive element (buttons, filters, forms, tabs) must be reachable and operable via keyboard. Visible focus indicators must be distinct and not obscured by sticky headers.
3. **Color Contrast**: All text must meet the 4.5:1 contrast ratio against its background. State changes (like urgency badges) must not rely solely on color (use text labels and icons).
4. **Forms & Validation**: All inputs must have explicit `<label>` elements. Error messages must be linked to their inputs via `aria-describedby` and announced to screen readers.
5. **Reduced Motion**: Respect user OS preferences (`prefers-reduced-motion: reduce`) by disabling unnecessary animations (e.g., ticking countdown timers will be static text or drastically slowed down).
6. **ARIA Usage**: Use ARIA attributes sparingly and correctly (e.g., `aria-expanded` on accordions, `aria-live` regions for dynamic status changes like price drops).

## Audit & Tools
- We will integrate `axe-core` into the Playwright tests to catch accessibility regressions automatically.
- Manual testing with keyboard and screen reader simulation will be conducted for the complex QR handover and auction flows.
