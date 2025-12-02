-- Migration: Add index on soldier_appointments.notes for faster form-based queries
-- This improves performance when searching for appointments by form ID (DA6_FORM:${id})

-- Create index on notes field for appointments that have form references
-- This uses a partial index to only index rows with form references, saving space
CREATE INDEX IF NOT EXISTS idx_soldier_appointments_notes 
ON soldier_appointments(notes) 
WHERE notes LIKE 'DA6_FORM:%';

-- Note: For even better performance with LIKE queries, you can optionally enable
-- the pg_trgm extension and create a GIN index. However, the above index should
-- be sufficient for most use cases. If you want to enable pg_trgm:
-- 
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_soldier_appointments_notes_gin 
-- ON soldier_appointments USING gin(notes gin_trgm_ops)
-- WHERE notes IS NOT NULL;

