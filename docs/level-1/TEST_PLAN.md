# Test Plan

## 1. Domain Logic (Unit Tests)
**Tool**: Vitest
**Scope**: 
The core business logic (Dutch auction pricing, rental calculations, rent-to-own math, environmental impact formulas) will be extracted into pure TypeScript functions. These must have 100% test coverage and explicitly verify edge cases:
- Price decay hits floor exactly 2 hours before departure.
- Prices round to the nearest ₹5.
- Rent-to-own conversion correctly calculates 50% credit without dropping below floor price.

## 2. Server Actions & Database Interactions (Integration Tests)
**Tool**: Vitest / Supabase Local
**Scope**:
- Verify concurrent claim requests only result in one winner (atomic constraint).
- Validate Row Level Security (RLS) policies by asserting that a student cannot modify another student's item status.
- Ensure Zod validation rejects negative prices or invalid departure times.

## 3. End-to-End Workflows (E2E Tests)
**Tool**: Playwright
**Scope**:
- **Marketplace Flow**: A user logs in, browses, views an item, and claims it.
- **Rental Flow**: A user rents an item, the deposit is processed (simulated), and they later convert it to buy.
- **Warden Flow**: A warden logs in, navigates to the dashboard, and marks a "Staff Reserve" item as collected.

## 4. Accessibility Testing
**Tool**: axe-core / Playwright A11y
**Scope**: Run automated scans on primary pages (Marketplace, Dashboard, Item Detail) across mobile and desktop viewports.
