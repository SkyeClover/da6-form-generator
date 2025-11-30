-- Migration: Add holidays table and update da6_forms to support duty configurations
-- Run this to add holiday management and duty configuration support

-- Holidays table (user-defined holidays)
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, date) -- One holiday per date per user
);

CREATE INDEX IF NOT EXISTS idx_holidays_user_id ON holidays(user_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

-- Enable RLS
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- RLS Policies for holidays
DROP POLICY IF EXISTS "Users can view their own holidays" ON holidays;
CREATE POLICY "Users can view their own holidays"
  ON holidays FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own holidays" ON holidays;
CREATE POLICY "Users can insert their own holidays"
  ON holidays FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own holidays" ON holidays;
CREATE POLICY "Users can update their own holidays"
  ON holidays FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own holidays" ON holidays;
CREATE POLICY "Users can delete their own holidays"
  ON holidays FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at on holidays
CREATE TRIGGER update_holidays_updated_at
  BEFORE UPDATE ON holidays
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Note: The form_data JSONB column in da6_forms already supports flexible duty configurations
-- We'll store the following in form_data:
-- {
--   "duty_config": {
--     "nature_of_duty": "CQ",
--     "soldiers_per_day": 2,
--     "days_off_after_duty": 1,
--     "skip_weekends": true,
--     "separate_weekend_cycle": false,
--     "separate_holiday_cycle": false
--   },
--   "holidays": ["2024-01-01", "2024-07-04"],
--   "excluded_dates": ["2024-01-15"], // Dates where no one is needed
--   ...
-- }

