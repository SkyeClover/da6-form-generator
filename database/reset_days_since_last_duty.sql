-- Reset all days_since_last_duty to 0 for all soldiers
-- This allows you to start fresh with your seed data

-- Option 1: Reset for all soldiers
UPDATE soldiers SET days_since_last_duty = 0;

-- Option 2: Reset only for a specific user (safer)
-- Replace 'USER_ID_HERE' with your actual user ID, or use the query below:
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the user ID for jacobwalker852@gmail.com
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'jacobwalker852@gmail.com'
    LIMIT 1;

    -- Only update if user exists
    IF v_user_id IS NOT NULL THEN
        UPDATE soldiers 
        SET days_since_last_duty = 0 
        WHERE user_id = v_user_id;
        
        RAISE NOTICE 'Reset days_since_last_duty to 0 for user: %', v_user_id;
    ELSE
        RAISE NOTICE 'User jacobwalker852@gmail.com not found.';
    END IF;
END $$;

-- Verify the reset (optional)
-- SELECT rank, last_name, days_since_last_duty FROM soldiers WHERE user_id = (SELECT id FROM auth.users WHERE email = 'jacobwalker852@gmail.com') ORDER BY rank, last_name;

