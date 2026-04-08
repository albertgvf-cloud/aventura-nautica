-- Admin notices per day/activity for commercial staff
-- Run this in Supabase SQL Editor → New query → Paste → Run

create table notices (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  activity_type text,                    -- null = all activities, or 'nautic', 'parasailing', 'jets', 'boats', 'catamaran'
  message text not null,
  type text not null default 'info',     -- 'info', 'discount', 'warning'
  active boolean not null default true,
  created_by uuid references employees(id),
  created_at timestamptz not null default now()
);

create index notices_date_idx on notices (date);

alter table notices enable row level security;

create policy "notices_read" on notices for select using (is_employee());
create policy "notices_write" on notices for all using (is_admin()) with check (is_admin());
