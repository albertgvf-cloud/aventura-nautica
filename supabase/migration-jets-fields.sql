-- Add jet-specific fields to reservations
-- Run this in Supabase SQL Editor → New query → Paste → Run
ALTER TABLE reservations ADD COLUMN jet_id text;
ALTER TABLE reservations ADD COLUMN duration_minutes int;
CREATE INDEX reservations_jet_id_idx ON reservations (jet_id);
