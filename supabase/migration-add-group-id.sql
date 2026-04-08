-- Link jet reservations that belong to the same booking
-- Run this in Supabase SQL Editor → New query → Paste → Run
ALTER TABLE reservations ADD COLUMN group_id uuid;
CREATE INDEX reservations_group_id_idx ON reservations (group_id);
