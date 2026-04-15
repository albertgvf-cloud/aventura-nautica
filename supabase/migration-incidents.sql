-- Add incident tracking columns to reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS incident_type TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS incident_comment TEXT;
