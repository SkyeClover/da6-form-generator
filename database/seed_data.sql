-- Seed Data for DA6 Form Generator
-- This adds sample soldiers for testing
-- Note: Replace 'USER_ID_HERE' with the actual user ID from auth.users table

-- First, get the user ID (you'll need to run this query first to get your user ID)
-- SELECT id, email FROM auth.users WHERE email = 'jacobwalker852@gmail.com';

-- Then replace USER_ID_HERE below with that ID, or use this query:
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the user ID for jacobwalker852@gmail.com
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'jacobwalker852@gmail.com'
    LIMIT 1;

    -- Only insert if user exists
    IF v_user_id IS NOT NULL THEN
        -- Insert sample soldiers
        INSERT INTO soldiers (user_id, first_name, last_name, middle_initial, rank, mos, edipi, unit, phone, email, notes, days_since_last_duty)
        VALUES
            (v_user_id, 'CHARLES', 'SMITH', '', 'PVT', '11B', '1234567890', '1st Battalion, 123rd Infantry', '555-0101', 'charles.smith@army.mil', 'Experienced infantryman', 5),
            (v_user_id, 'DAVIS', 'JOHNSON', 'M', 'PVT', '11B', '1234567891', '1st Battalion, 123rd Infantry', '555-0102', 'davis.johnson@army.mil', NULL, 12),
            (v_user_id, 'DITRICH', 'WILLIAMS', '', 'PVT', '11B', '1234567892', '1st Battalion, 123rd Infantry', '555-0103', 'ditrich.williams@army.mil', NULL, 8),
            (v_user_id, 'HOOPER', 'BROWN', 'J', 'PVT', '11B', '1234567893', '1st Battalion, 123rd Infantry', '555-0104', 'hooper.brown@army.mil', 'Team leader', 3),
            (v_user_id, 'CALLAGHN', 'JONES', '', 'PVT', '11B', '1234567894', '1st Battalion, 123rd Infantry', '555-0105', 'callaghn.jones@army.mil', NULL, 15),
            (v_user_id, 'CALLAWAY', 'GARCIA', 'R', 'PVT', '11B', '1234567895', '1st Battalion, 123rd Infantry', '555-0106', 'callaway.garcia@army.mil', NULL, 7),
            (v_user_id, 'CAVENADUGH', 'MILLER', '', 'PVT', '11B', '1234567896', '1st Battalion, 123rd Infantry', '555-0107', 'cavenadugh.miller@army.mil', NULL, 20),
            (v_user_id, 'DONAVAN', 'DAVIS', 'L', 'PVT', '11B', '1234567897', '1st Battalion, 123rd Infantry', '555-0108', 'donavan.davis@army.mil', NULL, 4),
            (v_user_id, 'MURPHY', 'RODRIGUEZ', '', 'PV2', '11B', '1234567898', '1st Battalion, 123rd Infantry', '555-0109', 'murphy.rodriguez@army.mil', NULL, 9),
            (v_user_id, 'ABLE', 'MARTINEZ', 'K', 'PV2', '11B', '1234567899', '1st Battalion, 123rd Infantry', '555-0110', 'able.martinez@army.mil', NULL, 11),
            (v_user_id, 'BAKER', 'HERNANDEZ', '1', 'PV2', '11B', '1234567900', '1st Battalion, 123rd Infantry', '555-0111', 'baker1.hernandez@army.mil', 'First Baker', 6),
            (v_user_id, 'BAKER', 'LOPEZ', '2', 'PV2', '11B', '1234567901', '1st Battalion, 123rd Infantry', '555-0112', 'baker2.lopez@army.mil', 'Second Baker', 14),
            (v_user_id, 'CHARLES', 'WILSON', '', 'PFC', '11B', '1234567902', '1st Battalion, 123rd Infantry', '555-0113', 'charles.wilson@army.mil', NULL, 2),
            (v_user_id, 'DAVIS', 'ANDERSON', 'T', 'PFC', '11B', '1234567903', '1st Battalion, 123rd Infantry', '555-0114', 'davis.anderson@army.mil', NULL, 18),
            (v_user_id, 'DITRICH', 'THOMAS', '', 'PFC', '11B', '1234567904', '1st Battalion, 123rd Infantry', '555-0115', 'ditrich.thomas@army.mil', NULL, 10),
            (v_user_id, 'HOOPER', 'TAYLOR', 'S', 'PFC', '11B', '1234567905', '1st Battalion, 123rd Infantry', '555-0116', 'hooper.taylor@army.mil', NULL, 13),
            (v_user_id, 'CALLAGHN', 'MOORE', '', 'PFC', '11B', '1234567906', '1st Battalion, 123rd Infantry', '555-0117', 'callaghn.moore@army.mil', NULL, 1),
            (v_user_id, 'CALLAWAY', 'JACKSON', 'A', 'PFC', '11B', '1234567907', '1st Battalion, 123rd Infantry', '555-0118', 'callaway.jackson@army.mil', NULL, 16),
            (v_user_id, 'ROBERTS', 'MARTIN', '', 'SGT', '11B', '1234567908', '1st Battalion, 123rd Infantry', '555-0119', 'roberts.martin@army.mil', 'Squad Leader', 25),
            (v_user_id, 'THOMPSON', 'LEE', 'B', 'SSG', '11B', '1234567909', '1st Battalion, 123rd Infantry', '555-0120', 'thompson.lee@army.mil', 'Section Leader', 30)
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Seed data inserted for user: %', v_user_id;
    ELSE
        RAISE NOTICE 'User jacobwalker852@gmail.com not found. Please sign in first to create your account.';
    END IF;
END $$;

