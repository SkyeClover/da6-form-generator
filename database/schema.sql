-- DA6 Form Generator Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  rank TEXT,
  unit TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Soldiers/Personnel table
CREATE TABLE IF NOT EXISTS soldiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_initial TEXT,
  rank TEXT NOT NULL,
  mos TEXT, -- Military Occupational Specialty
  edipi TEXT, -- Electronic Data Interchange Personal Identifier
  unit TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  days_since_last_duty INTEGER DEFAULT 0, -- Days since last duty assignment (for unit migration)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- DA6 Forms table
CREATE TABLE IF NOT EXISTS da6_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  form_data JSONB NOT NULL, -- Stores the complete form data
  status TEXT DEFAULT 'draft', -- draft, completed, submitted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Soldier Appointments table (for tracking unavailability)
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_soldiers_user_id ON soldiers(user_id);
CREATE INDEX IF NOT EXISTS idx_da6_forms_user_id ON da6_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_da6_forms_period ON da6_forms(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_soldier_appointments_soldier_id ON soldier_appointments(soldier_id);
CREATE INDEX IF NOT EXISTS idx_soldier_appointments_user_id ON soldier_appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_soldier_appointments_dates ON soldier_appointments(start_date, end_date);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE soldier_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE soldiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE da6_forms ENABLE ROW LEVEL SECURITY;

-- User Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Soldiers policies
DROP POLICY IF EXISTS "Users can view their own soldiers" ON soldiers;
CREATE POLICY "Users can view their own soldiers"
  ON soldiers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own soldiers" ON soldiers;
CREATE POLICY "Users can insert their own soldiers"
  ON soldiers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own soldiers" ON soldiers;
CREATE POLICY "Users can update their own soldiers"
  ON soldiers FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own soldiers" ON soldiers;
CREATE POLICY "Users can delete their own soldiers"
  ON soldiers FOR DELETE
  USING (auth.uid() = user_id);

-- DA6 Forms policies
DROP POLICY IF EXISTS "Users can view their own DA6 forms" ON da6_forms;
CREATE POLICY "Users can view their own DA6 forms"
  ON da6_forms FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own DA6 forms" ON da6_forms;
CREATE POLICY "Users can insert their own DA6 forms"
  ON da6_forms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own DA6 forms" ON da6_forms;
CREATE POLICY "Users can update their own DA6 forms"
  ON da6_forms FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own DA6 forms" ON da6_forms;
CREATE POLICY "Users can delete their own DA6 forms"
  ON da6_forms FOR DELETE
  USING (auth.uid() = user_id);

-- Soldier Appointments policies
DROP POLICY IF EXISTS "Users can view their own soldier appointments" ON soldier_appointments;
CREATE POLICY "Users can view their own soldier appointments"
  ON soldier_appointments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own soldier appointments" ON soldier_appointments;
CREATE POLICY "Users can insert their own soldier appointments"
  ON soldier_appointments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own soldier appointments" ON soldier_appointments;
CREATE POLICY "Users can update their own soldier appointments"
  ON soldier_appointments FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own soldier appointments" ON soldier_appointments;
CREATE POLICY "Users can delete their own soldier appointments"
  ON soldier_appointments FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_soldiers_updated_at
  BEFORE UPDATE ON soldiers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_da6_forms_updated_at
  BEFORE UPDATE ON da6_forms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_soldier_appointments_updated_at
  BEFORE UPDATE ON soldier_appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

