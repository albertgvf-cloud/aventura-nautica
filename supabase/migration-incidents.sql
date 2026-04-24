-- Add incident tracking columns to reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS incident_type TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS incident_comment TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS incident_resolution TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS incident_refund_amount NUMERIC;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS incident_refund_type TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS incident_resolved_by TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS incident_authorized_by TEXT;
