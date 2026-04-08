-- Audit log for tracking all reservation changes
-- Run this in Supabase SQL Editor → New query → Paste → Run

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid,
  action text not null,          -- 'created', 'cancelled', 'modified', 'arrived', 'departed', 'deleted', 'reactivated'
  performed_by text,             -- staff name
  activity_type text,            -- 'nautic', 'parasailing', 'jets', 'boats', 'catamaran'
  client_name text,
  details text,                  -- description of what changed
  created_at timestamptz not null default now()
);

create index audit_log_date_idx on audit_log (created_at);
create index audit_log_action_idx on audit_log (action);

alter table audit_log enable row level security;

-- All employees can write logs
create policy "audit_write" on audit_log for insert with check (true);
-- Only admins can read logs
create policy "audit_read" on audit_log for select using (is_admin());
