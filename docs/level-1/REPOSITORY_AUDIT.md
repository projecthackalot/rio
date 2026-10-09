# RIO Repository Audit

## Overview
The current repository (`codedecoyz/rio-app-streamlit`) implements the RIO Circular Asset Handover product as a functional prototype using **Streamlit**. It effectively demonstrates the core domain logic—Dutch auction pricing, rentals, rent-to-own, QR verification flows, and staff welfare handover—but operates entirely in-memory with simulated data, clock, and payments.

## Codebase Structure
- `app.py`: Streamlit entry point, handles page navigation.
- `rio/engine.py`: Core domain logic. It implements pricing rules (decay from start to floor), status transitions based on simulated time, rental costs, deposit calculations, and impact math. This logic is pure Python and isolated from Streamlit.
- `rio/data.py`: Pre-seeded in-memory state. Contains 6 simulated students, wardens, staff, and ~14 initial items with pre-seeded transaction history to demonstrate the dashboard features immediately.
- `rio/ui.py`: Streamlit UI helpers, custom CSS injection, badge rendering, Plotly charts for utilization/impact, and QR code generation (with fallback).
- `views/`: Streamlit pages (`landing.py`, `demo.py`, `how_it_works.py`, `team.py`).
- `tests/`: Extensive pytest suite covering `rio/engine.py`. Tests verify domain rules (45 passing tests).

## Implemented Features (Verified)
- **Marketplace & Dutch Auction**: Prices decay automatically as departure time approaches (floor reached 2 hours before departure).
- **Rentals & Rent-to-Own**: Users can rent items for a fraction of the cost, and 50% of the rent paid applies as credit toward a final purchase.
- **Urgency/Status Badges**: Displayed dynamically based on hours to departure.
- **Anti-hoarding Logic**: Limits users to claiming one item per category.
- **Impact Calculations**: Estimated CO₂ saved and waste diverted per transaction.
- **Warden/Staff Handovers**: Items not claimed 1 hour before departure enter the "Staff Reserve" status.

## Limitations & Unverified Assumptions (To be Addressed in Level 1)
- **Authentication**: Non-existent. Users "log in" by selecting a name from a dropdown.
- **Persistence**: Non-existent. All data lives in `st.session_state`. Refreshing the app resets the clock and transactions.
- **Concurrency**: Streamlit session state is isolated per tab. Multi-user interactions are not possible.
- **Clock**: Driven manually by a slider (`sim_hour`), rather than real time.
- **Payments**: Purely simulated wallet deductions.
- **Media**: No real image uploads, only a mock hash is generated.
- **QR Codes**: QR codes generate correctly but have no scanner ingestion endpoint or token expiration validation logic.

## Goal for Level 1 Build
Port this prototype into a robust **Next.js App Router** architecture with **Supabase** (Auth, PostgreSQL, Storage). We will implement a `web/` directory for the new app to keep the Streamlit prototype functional during migration.

**Status:** Completed repository audit. Proceeding to Implementation Plan.
