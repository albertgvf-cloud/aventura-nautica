-- =====================================================================
-- AVENTURA NAUTICA — DATABASE SCHEMA
-- Run this in Supabase SQL Editor (left sidebar → SQL Editor → New query)
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. EMPLOYEES (linked to Supabase Auth users)
-- ------------------------------------------------------------------
create type employee_role as enum ('admin', 'reception', 'guide', 'accountant');

create table employees (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role employee_role not null default 'reception',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- 2. CUSTOMERS
-- ------------------------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  date_of_birth date,
  nationality text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references employees(id)
);

create index customers_name_idx on customers (full_name);
create index customers_email_idx on customers (email);
create index customers_phone_idx on customers (phone);

-- ------------------------------------------------------------------
-- 3. ACTIVITIES (the 5 families)
-- ------------------------------------------------------------------
create table activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  display_order int default 0
);

-- ------------------------------------------------------------------
-- 4. ACTIVITY VARIANTS (Monster, Crazy, Banana, Bliss 45 Private, etc.)
-- ------------------------------------------------------------------
create table activity_variants (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int,
  max_participants int,
  min_participants int default 1,
  base_price numeric(10,2),
  requires_license boolean default false,
  active boolean not null default true
);

-- ------------------------------------------------------------------
-- 5. RESOURCES (physical assets: each boat, jet, catamaran)
-- ------------------------------------------------------------------
create type resource_type as enum ('boat', 'jet_ski', 'catamaran', 'parasail_boat', 'nautic_boat');

create table resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,                -- "Jet VX #1", "Boat-License #12", "Bliss 45"
  type resource_type not null,
  model text,                         -- "VX", "EX100", "Jetblaster", "X180", "Bliss 45", "Bliss 70"
  capacity int,
  requires_license boolean default false,
  active boolean not null default true,
  notes text
);

-- ------------------------------------------------------------------
-- 6. BOOKINGS (one per customer purchase, can contain multiple items)
-- ------------------------------------------------------------------
create type booking_status as enum ('confirmed', 'cancelled', 'completed', 'no_show');
create type booking_source as enum ('direct_customer', 'point_of_sale', 'phone', 'email', 'agency');
create type payment_status as enum ('pending', 'paid', 'partial', 'refunded');
create type payment_method as enum ('cash', 'card', 'bank_transfer', 'online');

create table bookings (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null default concat('BK-', to_char(now(),'YYMMDD'), '-', substring(gen_random_uuid()::text, 1, 6)),
  customer_id uuid not null references customers(id),
  booking_date date not null,               -- date the customer made the booking
  status booking_status not null default 'confirmed',
  source booking_source not null default 'direct_customer',
  total_amount numeric(10,2) not null default 0,
  payment_status payment_status not null default 'pending',
  payment_method payment_method,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references employees(id),
  cancelled_at timestamptz,
  cancellation_fee numeric(10,2) default 0
);

create index bookings_customer_idx on bookings (customer_id);
create index bookings_date_idx on bookings (booking_date);
create index bookings_status_idx on bookings (status);

-- ------------------------------------------------------------------
-- 7. BOOKING ITEMS (each activity within a booking)
-- ------------------------------------------------------------------
create table booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  activity_variant_id uuid not null references activity_variants(id),
  resource_id uuid references resources(id),          -- specific jet/boat assigned
  guide_id uuid references employees(id),              -- assigned guide (optional)
  scheduled_start timestamptz not null,                -- when the activity starts
  scheduled_end timestamptz not null,                  -- when it ends
  participants int not null default 1,
  unit_price numeric(10,2) not null default 0,
  total_price numeric(10,2) not null default 0,
  notes text
);

create index booking_items_booking_idx on booking_items (booking_id);
create index booking_items_resource_idx on booking_items (resource_id);
create index booking_items_start_idx on booking_items (scheduled_start);
create index booking_items_end_idx on booking_items (scheduled_end);

-- ------------------------------------------------------------------
-- 8. PAYMENTS (one booking can have multiple payments)
-- ------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  amount numeric(10,2) not null,
  method payment_method not null,
  paid_at timestamptz not null default now(),
  invoice_number text,
  notes text,
  created_by uuid references employees(id)
);

-- ------------------------------------------------------------------
-- 9. ROW-LEVEL SECURITY (enable so only logged-in employees can read)
-- ------------------------------------------------------------------
alter table employees enable row level security;
alter table customers enable row level security;
alter table activities enable row level security;
alter table activity_variants enable row level security;
alter table resources enable row level security;
alter table bookings enable row level security;
alter table booking_items enable row level security;
alter table payments enable row level security;

-- Helper: check if current user is an active employee
create or replace function is_employee() returns boolean as $$
  select exists (
    select 1 from employees
    where id = auth.uid() and active = true
  );
$$ language sql security definer stable;

-- Helper: check if current user is admin
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from employees
    where id = auth.uid() and role = 'admin' and active = true
  );
$$ language sql security definer stable;

-- Policies: any active employee can read everything
create policy "employees_read" on employees for select using (is_employee());
create policy "customers_read" on customers for select using (is_employee());
create policy "activities_read" on activities for select using (is_employee());
create policy "variants_read" on activity_variants for select using (is_employee());
create policy "resources_read" on resources for select using (is_employee());
create policy "bookings_read" on bookings for select using (is_employee());
create policy "booking_items_read" on booking_items for select using (is_employee());
create policy "payments_read" on payments for select using (is_employee());

-- Policies: any active employee can write customers, bookings, items, payments
create policy "customers_write" on customers for all using (is_employee()) with check (is_employee());
create policy "bookings_write" on bookings for all using (is_employee()) with check (is_employee());
create policy "booking_items_write" on booking_items for all using (is_employee()) with check (is_employee());
create policy "payments_write" on payments for all using (is_employee()) with check (is_employee());

-- Policies: only admins can edit activities, variants, resources, employees
create policy "activities_admin" on activities for all using (is_admin()) with check (is_admin());
create policy "variants_admin" on activity_variants for all using (is_admin()) with check (is_admin());
create policy "resources_admin" on resources for all using (is_admin()) with check (is_admin());
create policy "employees_admin" on employees for all using (is_admin()) with check (is_admin());
