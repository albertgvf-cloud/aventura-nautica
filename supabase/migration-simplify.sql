-- =====================================================================
-- AVENTURA NAUTICA — SIMPLIFIED SCHEMA
-- A flat reservations table matching the Excel planning layout.
-- Run this in Supabase SQL Editor → New query → Paste → Run
-- =====================================================================

-- One simple table for all reservations
create table reservations (
  id uuid primary key default gen_random_uuid(),

  -- What
  activity_type text not null,            -- 'nautic', 'parasailing', 'jets', 'boats', 'catamaran'
  activity text not null,                  -- 'MONSTER', 'CRAZY', 'BANANA', 'Parasailing', 'Jet VX #3', 'Bliss 70 Morning', etc.

  -- When
  date date not null,
  time time not null,

  -- Who
  num_people int not null default 1,
  client_name text not null,
  phone text,

  -- Staff
  staff text,                              -- name of who took the booking
  office text,                             -- 'Santa 1', 'Plataforma', 'Roses', 'Empu', 'Santa 2'

  -- Status
  status text not null default 'Confirmada',  -- 'Confirmada', 'Cancelada', 'Pendiente'
  arrived boolean default false,
  actual_time time,

  notes text,
  created_at timestamptz not null default now()
);

-- Indexes for fast queries
create index reservations_date_idx on reservations (date);
create index reservations_activity_type_idx on reservations (activity_type);
create index reservations_status_idx on reservations (status);

-- Row-level security: only logged-in employees can access
alter table reservations enable row level security;

create policy "reservations_read" on reservations
  for select using (is_employee());

create policy "reservations_write" on reservations
  for all using (is_employee()) with check (is_employee());
