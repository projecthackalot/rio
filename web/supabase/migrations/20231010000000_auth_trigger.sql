-- Secure Profile Creation Trigger
-- This function automatically creates a profile for every new user who signs up.
-- It strictly enforces the 'student' role, preventing any client-side role escalation.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, wallet_balance)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Student'),
    'student', -- Hardcoded to student, cannot be escalated via signup
    3000.0     -- Sandbox simulated balance
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Drop trigger if exists to allow idempotency
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
