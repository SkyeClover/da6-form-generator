-- Migration: Add cancelled_date field and update status values
-- This migration adds support for 'in_progress', 'complete', and 'cancelled' statuses
-- and adds a cancelled_date field for tracking when forms were cancelled

-- Add cancelled_date column to da6_forms table
ALTER TABLE da6_forms 
ADD COLUMN IF NOT EXISTS cancelled_date DATE;

-- Update existing status values to match new schema
-- 'completed' -> 'complete'
UPDATE da6_forms 
SET status = 'complete' 
WHERE status = 'completed';

-- 'submitted' -> 'complete' (assuming submitted forms are complete)
UPDATE da6_forms 
SET status = 'complete' 
WHERE status = 'submitted';

-- Add comment to status column documenting valid values
COMMENT ON COLUMN da6_forms.status IS 'Form status: draft, in_progress, complete, cancelled';

-- Add comment to cancelled_date column
COMMENT ON COLUMN da6_forms.cancelled_date IS 'Date when the form was cancelled (only set when status is cancelled)';

