-- Add departed column to reservations table
-- Run this in Supabase SQL Editor → New query → Paste → Run
alter table reservations add column departed boolean default false;
