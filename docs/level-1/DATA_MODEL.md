# Data Model

The data foundation will be implemented in PostgreSQL via Supabase migrations.

## Core Tables

### `profiles`
Maps 1:1 with Supabase Auth users.
- `id` (uuid, references auth.users)
- `role` (enum: 'student', 'warden', 'staff')
- `full_name` (text)
- `campus_id` (uuid)
- `block` (text)
- `room` (text, not exposed publicly)
- `departure_time` (timestamptz, nullable)
- `wallet_balance` (numeric, explicit simulation)

### `items`
Represents marketplace listings.
- `id` (uuid, primary key)
- `owner_id` (uuid, references profiles)
- `title` (text)
- `category` (text)
- `description` (text)
- `image_url` (text)
- `start_price` (numeric)
- `floor_price` (numeric)
- `listed_at` (timestamptz)
- `departure_time` (timestamptz, nullable)
- `is_rentable` (boolean)
- `status` (enum: 'ACTIVE', 'CLAIMED', 'RENTED', 'SETTLED', 'STAFF_ROUTED', 'DISPUTED')

### `claims`
Atomic reservation of an item.
- `id` (uuid, primary key)
- `item_id` (uuid, unique per active claim)
- `claimer_id` (uuid)
- `claimed_at` (timestamptz)
- `status` (enum: 'PENDING_HANDOVER', 'COMPLETED', 'CANCELLED')
- `agreed_price` (numeric)
- `qr_token_hash` (text, unique)
- `qr_expires_at` (timestamptz)

### `rentals`
Records of rental bookings.
- `id` (uuid, primary key)
- `item_id` (uuid)
- `renter_id` (uuid)
- `period` (enum: 'DAY', 'WEEK', 'MONTH')
- `rent_paid` (numeric)
- `deposit` (numeric)
- `start_time` (timestamptz)
- `end_time` (timestamptz)
- `status` (enum: 'ACTIVE', 'RETURNED', 'CONVERTED_TO_BUY')

### `ledger` (Simulated Transactions)
Explicitly mock transaction records for Level 1 sandbox.
- `id` (uuid)
- `user_id` (uuid)
- `amount` (numeric, positive/negative)
- `type` (text: 'PURCHASE', 'SALE', 'RENTAL', 'RENTAL_INCOME')
- `item_id` (uuid, nullable)
- `created_at` (timestamptz)
