# Security & Authorization

## Authentication
Level 1 utilizes Supabase Auth for identity management. All protected routes require a verified session. 

## Row Level Security (RLS)
RLS will be applied to all PostgreSQL tables, ensuring zero unauthorized access regardless of the client calling the API.

- **Profiles**: Users can read basic profile info of others on the same campus, but private details (room numbers, exact departure times) are isolated. A user can only update their own profile.
- **Items**: 
  - `SELECT`: Public/All authenticated users (for active items).
  - `INSERT/UPDATE`: Only the `owner_id`. Wardens can update status for dispute/staff routing.
- **Claims/Rentals**:
  - `SELECT`: Only the item owner, the claimer/renter, and Wardens.
  - `INSERT`: Allowed if the item is 'ACTIVE', the user is not the owner, and no concurrent active claim exists.
- **Ledger**: Users can only see records where `user_id` matches their own. Wardens may have aggregate read access.

## Privacy & Data Protection
- Exact room numbers are never published to the broader marketplace feed. They are only disclosed selectively during the active QR handover phase to the verified claimer.
- Passwords are fully managed by Supabase; the application backend never touches raw passwords.
- **Storage**: Image uploads are restricted to allowed MIME types (JPEG, PNG, WebP) with a strict file size limit (e.g., 5MB) via Supabase Storage policies. 

## QR Code Handover
QR tokens are:
- Single-use.
- Short-lived (expiring).
- Stored as cryptographic hashes in the database (or as high-entropy secure random strings).
- Contain no private user data in the payload.
