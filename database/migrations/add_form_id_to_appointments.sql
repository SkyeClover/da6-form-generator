-- Migration: Add form_id column to soldier_appointments table
-- This allows direct linking of appointments to DA6 forms using UUIDs
-- Run this in your Supabase SQL editor

-- Add form_id column (nullable, since not all appointments are from forms)
ALTER TABLE soldier_appointments 
ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES da6_forms(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_soldier_appointments_form_id 
ON soldier_appointments(form_id) 
WHERE form_id IS NOT NULL;

-- Backfill existing appointments: Extract form_id from notes field
-- This updates appointments that have "DA6_FORM:UUID" in their notes
UPDATE soldier_appointments
SET form_id = (
  SELECT id::uuid
  FROM da6_forms
  WHERE soldier_appointments.notes LIKE '%DA6_FORM:' || da6_forms.id::text || '%'
    AND soldier_appointments.user_id = da6_forms.user_id
  LIMIT 1
)
WHERE form_id IS NULL
  AND notes LIKE '%DA6_FORM:%'
  AND (exception_code = 'P' OR exception_code = 'D'); -- Only auto-generated appointments

-- Add comment to column
COMMENT ON COLUMN soldier_appointments.form_id IS 'References the DA6 form that created this appointment (for auto-generated duty and pass appointments)';

