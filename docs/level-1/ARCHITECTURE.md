# Architecture

## Target Technology Stack
- **Framework**: Next.js App Router (React, Server Components, Server Actions).
- **Language**: TypeScript with strict type checking.
- **Styling**: Tailwind CSS, utilizing a premium, distinctive custom design system.
- **Database & Auth**: Supabase (PostgreSQL, Supabase Auth, Storage).
- **Validation**: Zod (for server and client-side forms).
- **Testing**: Vitest (domain logic), Playwright (E2E workflows).
- **Deployment target**: Vercel-compatible structure.

## Structure
The original Streamlit application remains at the repository root.
The new Next.js application will be scaffolded within the `web/` directory.

### Directory Layout (`web/`)
- `src/app/`: Next.js App Router routes and pages.
- `src/components/`: Reusable UI components (buttons, cards, forms, typography).
- `src/lib/`: Domain logic ported from Python (pricing, rental rules, impact math). Pure functions only.
- `src/db/`: Database access layers, Supabase client initialization.
- `src/actions/`: Next.js Server Actions for secure mutations (claims, rentals, listings).
- `supabase/migrations/`: Versioned database schema and RLS policies.

## Key Architectural Decisions
1. **Server Actions for Mutations**: To guarantee that claims and rentals are atomic, we will perform them entirely on the server using Server Actions communicating directly with PostgreSQL. Client-side checks are purely for UX.
2. **PostgreSQL Row Level Security (RLS)**: Enforced at the database layer to ensure Wardens see what they are allowed to see, and Students can only mutate their own records or claim available items.
3. **Simulated Clock Abstraction**: We will use actual server time by default but allow injecting a deterministic clock in tests and development to verify price decays quickly.
