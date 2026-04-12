-- Add extras column for catamaran bookings (Catering, Efoil, Sublue)
-- Run this in Supabase SQL Editor → New query → Paste → Run

alter table reservations add column if not exists extras text[];
