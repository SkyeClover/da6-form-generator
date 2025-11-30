-- Migration: Add days_since_last_duty column to soldiers table
-- Run this if you already have the schema.sql applied

ALTER TABLE soldiers 
ADD COLUMN IF NOT EXISTS days_since_last_duty INTEGER DEFAULT 0;

COMMENT ON COLUMN soldiers.days_since_last_duty IS 'Days since last duty assignment - important for unit migration to track existing duty history';

