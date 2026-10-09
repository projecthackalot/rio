# Architectural & Product Decisions

1. **Next.js App Router over Streamlit**: Streamlit served as an excellent rapid prototype for validating the domain model. Next.js is chosen for Level 1 to provide a robust, concurrent, secure, and highly customizable UI for real users.
2. **Server Actions**: We chose Server Actions to ensure critical transaction steps (claiming, renting) happen server-side, enabling atomic database operations without exposing complex client-side state management.
3. **Supabase**: Selected as the Backend-as-a-Service to rapidly deliver PostgreSQL, Auth, and Storage. RLS natively solves complex multi-tenant data access (Warden vs Student).
4. **Simulated Sandbox Economy**: For Level 1, we explicitly remain in a "sandbox" for payments. Integrating a real payment gateway (Razorpay/Stripe) introduces massive scope and regulatory overhead. The UX will clearly label wallet balances as "Simulated" or "Sandbox".
5. **Deterministic Testing Clock**: The auction depends heavily on time. For testing, we inject a deterministic clock into the engine, avoiding flaky tests based on real `Date.now()`. In production, it will use real UTC time.
6. **No-Dues as a Workflow**: The No-Dues interface is an isolated feature in RIO. It does not integrate with actual university infrastructure yet (Level 2/3 target). It serves to demonstrate the capability to Wardens.
