-- Migration: Add appointments/unavailability tracking for soldiers
-- Run this to add appointment tracking

CREATE TABLE IF NOT EXISTS soldier_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  soldier_id UUID NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL, -- e.g., "Leave", "Training", "Medical", "TDY", etc.
  exception_code TEXT, -- Maps to exception codes (A, L, T, TDY, etc.)
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_soldier_appointments_soldier_id ON soldier_appointments(soldier_id);
CREATE INDEX IF NOT EXISTS idx_soldier_appointments_user_id ON soldier_appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_soldier_appointments_dates ON soldier_appointments(start_date, end_date);

-- Enable RLS
ALTER TABLE soldier_appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own soldier appointments"
  ON soldier_appointments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own soldier appointments"
  ON soldier_appointments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own soldier appointments"
  ON soldier_appointments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own soldier appointments"
  ON soldier_appointments FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_soldier_appointments_updated_at
  BEFORE UPDATE ON soldier_appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

