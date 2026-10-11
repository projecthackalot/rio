# Accessibility (as built)

**Target:** WCAG 2.2 AA. Automated axe scans pass on the pages listed below. A manual
screen-reader audit has **not** been done yet.

## What's implemented

- **Structure:** a skip link to `#main`; landmarks (`header`, `nav` with labels, `main`,
  `aside`, `footer`); one `h1` per page; sections labelled by their headings; data tables
  with captions and `th scope`.
- **Keyboard:** everything is native `button`/`a`/`input`. Confirmations use the native
  `<dialog>` (`showModal`: focus is trapped, Esc closes, focus returns to the opener). The
  account menu and mobile filters use `<details>`. Horizontally scrolling tables are
  focusable, labelled regions. Focus is visible everywhere (3px forest outline).
- **Forms:** every control has a `<label>`. Hints and errors are linked with
  `aria-describedby`, invalid fields get `aria-invalid`, server validation errors come back
  per field, typed values survive a failed submit (never passwords), and submit buttons
  show a pending state.
- **Announcements:** results use `role="status"` (polite) or `role="alert"` for errors.
  Loading skeletons are wrapped in `aria-busy` live regions. The handover panel moves focus
  to the new code and announces completion.
- **Colour:** measured contrast ratios are recorded in `globals.css` (body 13.4:1, muted
  text 5.7:1, accent text 4.7–5.7:1, form borders 3.8:1). Status is always text plus icon,
  never colour alone.
- **Touch targets:** at least 44×44 px for primary controls (small inline buttons are at
  least 36 px). There's a bottom tab bar on phones.
- **Motion:** one decorative animation (the hero example). `prefers-reduced-motion`
  disables it and all transitions.
- **Media:** photos need alt text (seller-provided description, falling back to the title).
  Category drawings are labelled as illustrations, not photos. The QR code has a text
  alternative, and the same code is printed for manual entry. The camera is optional, and
  typing the code always works.

## Automated checks

`tests/e2e/public.spec.ts` runs axe (wcag2a/aa, 2.1, 2.2 tags) on the landing page,
sign-in, sign-up (in its error state), password reset, magic link, check-email, auth
error and 404 pages, at Pixel 7 and 1366×900 sizes. Signed-in pages are covered only when
the opt-in journey runs against a seeded project.

Axe found one real issue during development (a horizontally scrolling table that wasn't
keyboard-reachable). It's fixed on all three tables.
