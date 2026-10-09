# Implementation Plan: Level 1 Foundation Build

## Approach
We will build the new RIO application in manageable vertical slices inside a `web/` directory, preserving the original Streamlit app in the root until the new application is fully functional and verified.

## Slices

### Slice 1: Foundation & Setup
- Initialize Next.js App Router with TypeScript and Tailwind CSS in `/web`.
- Set up Supabase project, generate local database migrations for the data model.
- Configure `.env.example` and strictly exclude secrets from git.
- Establish a design system (typography, colors, spacing) based on editorial, premium aesthetics.

### Slice 2: Authentication & Profiles
- Integrate Supabase Auth.
- Create sign-up, sign-in, and sign-out flows.
- Map Auth UUIDs to user profiles with roles (`student`, `warden`, `staff`).
- Enforce strict Row Level Security (RLS) on profile data.

### Slice 3: Marketplace & Dutch Auction
- Migrate the `rio/engine.py` Dutch pricing logic to a TypeScript domain library (`web/lib/engine.ts`).
- Create Marketplace listing feed with urgency badges.
- Implement item detail pages with mocked/static imagery (until storage is active) and price decay UI.
- Write Vitest unit tests verifying pricing logic against the Python baseline.

### Slice 4: Listings & Storage
- Implement the "List an Item" workflow with Zod validation.
- Secure Supabase Storage for item images (size limits, MIME types, RLS).
- Allow users to edit or withdraw their active listings.

### Slice 5: Claims, Rentals & Simulated Settlement
- Implement the atomic claim workflow (preventing duplicates via DB constraints).
- Implement the rental logic (Day/Week/Month) and rent-to-own credit math.
- Scaffold explicitly simulated transactions (sandbox ledger).

### Slice 6: QR Handover & Staff Welfare
- Implement QR generation (single-use expiry tokens) for claimed items.
- Implement Warden/Staff dashboard for the final-hour custody transfer.
- Implement the No-Dues interface.

### Slice 7: Quality & Final Polish
- Execute Playwright End-to-End tests on core workflows.
- Run `axe-core` accessibility checks.
- Audit responsive design across mobile, tablet, and desktop breakpoints.
