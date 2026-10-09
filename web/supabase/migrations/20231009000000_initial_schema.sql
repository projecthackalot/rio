-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- PROFILES
create type user_role as enum ('student', 'warden', 'staff');

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role user_role not null default 'student',
    full_name text not null,
    campus_id uuid,
    block text,
    room text,
    departure_time timestamptz,
    wallet_balance numeric not null default 0.0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ITEMS (Listings)
create type item_status as enum ('ACTIVE', 'CLAIMED_ESCROW', 'RENTED', 'SETTLED', 'STAFF_ROUTED', 'DISPUTED');

create table public.items (
    id uuid default uuid_generate_v4() primary key,
    owner_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    category text not null,
    description text,
    image_url text,
    start_price numeric not null check (start_price >= 0),
    floor_price numeric not null check (floor_price >= 0 and floor_price <= start_price),
    listed_at timestamptz not null default now(),
    departure_time timestamptz,
    is_rentable boolean not null default false,
    status item_status not null default 'ACTIVE',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- CLAIMS
create type claim_status as enum ('PENDING_HANDOVER', 'COMPLETED', 'CANCELLED');

create table public.claims (
    id uuid default uuid_generate_v4() primary key,
    item_id uuid references public.items(id) on delete cascade not null unique, -- One active claim per item
    claimer_id uuid references public.profiles(id) on delete cascade not null,
    claimed_at timestamptz not null default now(),
    status claim_status not null default 'PENDING_HANDOVER',
    agreed_price numeric not null,
    qr_token_hash text unique not null,
    qr_expires_at timestamptz not null
);

-- RENTALS
create type rental_period as enum ('DAY', 'WEEK', 'MONTH');
create type rental_status as enum ('ACTIVE', 'RETURNED', 'CONVERTED_TO_BUY');

create table public.rentals (
    id uuid default uuid_generate_v4() primary key,
    item_id uuid references public.items(id) on delete cascade not null,
    renter_id uuid references public.profiles(id) on delete cascade not null,
    period rental_period not null,
    rent_paid numeric not null,
    deposit numeric not null,
    start_time timestamptz not null default now(),
    end_time timestamptz not null,
    status rental_status not null default 'ACTIVE'
);

-- LEDGER (Explicit Sandbox Transactions)
create type ledger_type as enum ('PURCHASE', 'SALE', 'RENTAL', 'RENTAL_INCOME', 'REFUND');

create table public.ledger (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    amount numeric not null,
    type ledger_type not null,
    item_id uuid references public.items(id) on delete set null,
    note text,
    created_at timestamptz not null default now()
);

-- DISPUTES
create type dispute_status as enum ('OPEN', 'RESOLVED');

create table public.disputes (
    id uuid default uuid_generate_v4() primary key,
    item_id uuid references public.items(id) on delete cascade not null,
    reporter_id uuid references public.profiles(id) on delete cascade not null,
    reason text not null,
    evidence_url text,
    status dispute_status not null default 'OPEN',
    resolution_note text,
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);

-- ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.claims enable row level security;
alter table public.rentals enable row level security;
alter table public.ledger enable row level security;
alter table public.disputes enable row level security;

-- Profiles: Students can see basic profiles of others, wardens see all.
create policy "Public profiles are viewable by everyone." on public.profiles
    for select using (true);
    
create policy "Users can update own profile." on public.profiles
    for update using (auth.uid() = id);

-- Items: Anyone can view active items. Owners see their own. Wardens see all.
create policy "Active items are public." on public.items
    for select using (status = 'ACTIVE' or owner_id = auth.uid() or (select role from profiles where id = auth.uid()) = 'warden');

create policy "Users can insert their own items." on public.items
    for insert with check (owner_id = auth.uid());

create policy "Users can update their own items." on public.items
    for update using (owner_id = auth.uid());

create policy "Wardens can update any item." on public.items
    for update using ((select role from profiles where id = auth.uid()) = 'warden');

-- Claims: Claimers and owners can view. Claimers can insert.
create policy "Involved parties can view claims." on public.claims
    for select using (claimer_id = auth.uid() or (select owner_id from items where id = item_id) = auth.uid() or (select role from profiles where id = auth.uid()) = 'warden');

-- Only allow insert if there's no existing claim for this item
create policy "Users can claim items." on public.claims
    for insert with check (claimer_id = auth.uid() and not exists (select 1 from claims where item_id = claims.item_id));

-- Rentals: Similar to claims
create policy "Involved parties can view rentals." on public.rentals
    for select using (renter_id = auth.uid() or (select owner_id from items where id = item_id) = auth.uid() or (select role from profiles where id = auth.uid()) = 'warden');

create policy "Users can insert rentals." on public.rentals
    for insert with check (renter_id = auth.uid());

-- Ledger: Users see their own ledger.
create policy "Users can view their own ledger." on public.ledger
    for select using (user_id = auth.uid());

-- Storage
-- Assuming a 'listings' bucket exists
-- RLS policies for storage would be created in Supabase dashboard or via sql if superuser.
