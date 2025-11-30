-- Nuke and Reseed Script
-- This deletes all existing soldiers and appointments, then inserts fresh seed data with realistic appointments
-- WARNING: This will delete ALL soldiers and appointments for the specified user!

DO $$
DECLARE
    v_user_id UUID;
    v_soldier_ids UUID[];
    v_soldier_id UUID;
    v_soldier_count INTEGER;
    v_current_date DATE := CURRENT_DATE;
    v_appointment_date DATE;
    -- Soldier ID variables for appointments
    v_smith_id UUID;
    v_johnson_id UUID;
    v_williams_id UUID;
    v_brown_id UUID;
    v_jones_id UUID;
    v_garcia_id UUID;
    v_miller_id UUID;
    v_davis_id UUID;
    v_rodriguez_id UUID;
    v_martinez_id UUID;
    v_hernandez_id UUID;
    v_lopez_id UUID;
    v_wilson_id UUID;
    v_anderson_id UUID;
    v_thomas_id UUID;
    v_taylor_id UUID;
    v_moore_id UUID;
    v_jackson_id UUID;
    v_white_id UUID;
    v_harris_id UUID;
    v_martin_id UUID;
    v_thompson_id UUID;
    v_garcia_cpl_id UUID;
    v_martinez_cpl_id UUID;
    v_robinson_id UUID;
    v_clark_id UUID;
    v_rodriguez_sgt_id UUID;
    v_lewis_sgt_id UUID;
    v_lee_id UUID;
    v_walker_sgt_id UUID;
    v_hall_sgt_id UUID;
    v_allen_sgt_id UUID;
    v_young_id UUID;
    v_king_id UUID;
    v_wright_id UUID;
    v_lopez_ssg_id UUID;
    v_hill_id UUID;
    v_scott_id UUID;
    v_green_id UUID;
    v_adams_id UUID;
BEGIN
    -- Get the user ID for jacobwalker852@gmail.com
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'jacobwalker852@gmail.com'
    LIMIT 1;

    -- Only proceed if user exists
    IF v_user_id IS NOT NULL THEN
        RAISE NOTICE 'Starting nuke and reseed for user: %', v_user_id;
        
        -- Step 1: Delete all appointments for this user's soldiers
        DELETE FROM soldier_appointments 
        WHERE user_id = v_user_id;
        RAISE NOTICE 'Deleted all appointments';
        
        -- Step 2: Delete all soldiers for this user
        DELETE FROM soldiers 
        WHERE user_id = v_user_id;
        RAISE NOTICE 'Deleted all soldiers';
        
        -- Step 3: Insert fresh seed data
        INSERT INTO soldiers (user_id, first_name, last_name, middle_initial, rank, mos, edipi, unit, phone, email, notes, days_since_last_duty)
        VALUES
                -- Lower Enlisted (PVT - SPC) - 20 soldiers
                (v_user_id, 'CHARLES', 'SMITH', '', 'PVT', '11B', '1234567890', '1st Battalion, 123rd Infantry', '555-0101', 'charles.smith@army.mil', 'Experienced infantryman', 0),
                (v_user_id, 'DAVIS', 'JOHNSON', 'M', 'PVT', '11B', '1234567891', '1st Battalion, 123rd Infantry', '555-0102', 'davis.johnson@army.mil', NULL, 0),
                (v_user_id, 'DITRICH', 'WILLIAMS', '', 'PVT', '11B', '1234567892', '1st Battalion, 123rd Infantry', '555-0103', 'ditrich.williams@army.mil', NULL, 0),
                (v_user_id, 'HOOPER', 'BROWN', 'J', 'PVT', '11B', '1234567893', '1st Battalion, 123rd Infantry', '555-0104', 'hooper.brown@army.mil', 'Team leader', 0),
                (v_user_id, 'CALLAGHN', 'JONES', '', 'PVT', '11B', '1234567894', '1st Battalion, 123rd Infantry', '555-0105', 'callaghn.jones@army.mil', NULL, 0),
                (v_user_id, 'CALLAWAY', 'GARCIA', 'R', 'PVT', '11B', '1234567895', '1st Battalion, 123rd Infantry', '555-0106', 'callaway.garcia@army.mil', NULL, 0),
                (v_user_id, 'CAVENADUGH', 'MILLER', '', 'PVT', '11B', '1234567896', '1st Battalion, 123rd Infantry', '555-0107', 'cavenadugh.miller@army.mil', NULL, 0),
                (v_user_id, 'DONAVAN', 'DAVIS', 'L', 'PVT', '11B', '1234567897', '1st Battalion, 123rd Infantry', '555-0108', 'donavan.davis@army.mil', NULL, 0),
                (v_user_id, 'MURPHY', 'RODRIGUEZ', '', 'PV2', '11B', '1234567898', '1st Battalion, 123rd Infantry', '555-0109', 'murphy.rodriguez@army.mil', NULL, 0),
                (v_user_id, 'ABLE', 'MARTINEZ', 'K', 'PV2', '11B', '1234567899', '1st Battalion, 123rd Infantry', '555-0110', 'able.martinez@army.mil', NULL, 0),
                (v_user_id, 'BAKER', 'HERNANDEZ', '1', 'PV2', '11B', '1234567900', '1st Battalion, 123rd Infantry', '555-0111', 'baker1.hernandez@army.mil', 'First Baker', 0),
                (v_user_id, 'BAKER', 'LOPEZ', '2', 'PV2', '11B', '1234567901', '1st Battalion, 123rd Infantry', '555-0112', 'baker2.lopez@army.mil', 'Second Baker', 0),
                (v_user_id, 'CHARLES', 'WILSON', '', 'PFC', '11B', '1234567902', '1st Battalion, 123rd Infantry', '555-0113', 'charles.wilson@army.mil', NULL, 0),
                (v_user_id, 'DAVIS', 'ANDERSON', 'T', 'PFC', '11B', '1234567903', '1st Battalion, 123rd Infantry', '555-0114', 'davis.anderson@army.mil', NULL, 0),
                (v_user_id, 'DITRICH', 'THOMAS', '', 'PFC', '11B', '1234567904', '1st Battalion, 123rd Infantry', '555-0115', 'ditrich.thomas@army.mil', NULL, 0),
                (v_user_id, 'HOOPER', 'TAYLOR', 'S', 'PFC', '11B', '1234567905', '1st Battalion, 123rd Infantry', '555-0116', 'hooper.taylor@army.mil', NULL, 0),
                (v_user_id, 'CALLAGHN', 'MOORE', '', 'PFC', '11B', '1234567906', '1st Battalion, 123rd Infantry', '555-0117', 'callaghn.moore@army.mil', NULL, 0),
                (v_user_id, 'CALLAWAY', 'JACKSON', 'A', 'PFC', '11B', '1234567907', '1st Battalion, 123rd Infantry', '555-0118', 'callaway.jackson@army.mil', NULL, 0),
                (v_user_id, 'ROBERTS', 'WHITE', '', 'SPC', '11B', '1234567908', '1st Battalion, 123rd Infantry', '555-0119', 'roberts.white@army.mil', NULL, 0),
                (v_user_id, 'THOMPSON', 'HARRIS', 'B', 'SPC', '11B', '1234567909', '1st Battalion, 123rd Infantry', '555-0120', 'thompson.harris@army.mil', NULL, 0),
                
                -- NCO Ranks (CPL - SSG) - 20 soldiers
                (v_user_id, 'JACKSON', 'MARTIN', '', 'CPL', '11B', '1234567910', '1st Battalion, 123rd Infantry', '555-0121', 'jackson.martin@army.mil', 'Team Leader', 0),
                (v_user_id, 'LEWIS', 'THOMPSON', 'C', 'CPL', '11B', '1234567911', '1st Battalion, 123rd Infantry', '555-0122', 'lewis.thompson@army.mil', NULL, 0),
                (v_user_id, 'WALKER', 'GARCIA', '', 'CPL', '11B', '1234567912', '1st Battalion, 123rd Infantry', '555-0123', 'walker.garcia@army.mil', NULL, 0),
                (v_user_id, 'HALL', 'MARTINEZ', 'D', 'CPL', '11B', '1234567913', '1st Battalion, 123rd Infantry', '555-0124', 'hall.martinez@army.mil', NULL, 0),
                (v_user_id, 'ALLEN', 'ROBINSON', '', 'CPL', '11B', '1234567914', '1st Battalion, 123rd Infantry', '555-0125', 'allen.robinson@army.mil', NULL, 0),
                (v_user_id, 'YOUNG', 'CLARK', 'E', 'SGT', '11B', '1234567915', '1st Battalion, 123rd Infantry', '555-0126', 'young.clark@army.mil', 'Squad Leader', 0),
                (v_user_id, 'KING', 'RODRIGUEZ', '', 'SGT', '11B', '1234567916', '1st Battalion, 123rd Infantry', '555-0127', 'king.rodriguez@army.mil', 'Squad Leader', 0),
                (v_user_id, 'WRIGHT', 'LEWIS', 'F', 'SGT', '11B', '1234567917', '1st Battalion, 123rd Infantry', '555-0128', 'wright.lewis@army.mil', NULL, 0),
                (v_user_id, 'LOPEZ', 'LEE', '', 'SGT', '11B', '1234567918', '1st Battalion, 123rd Infantry', '555-0129', 'lopez.lee@army.mil', 'Squad Leader', 0),
                (v_user_id, 'HILL', 'WALKER', 'G', 'SGT', '11B', '1234567919', '1st Battalion, 123rd Infantry', '555-0130', 'hill.walker@army.mil', NULL, 0),
                (v_user_id, 'SCOTT', 'HALL', '', 'SGT', '11B', '1234567920', '1st Battalion, 123rd Infantry', '555-0131', 'scott.hall@army.mil', NULL, 0),
                (v_user_id, 'GREEN', 'ALLEN', 'H', 'SGT', '11B', '1234567921', '1st Battalion, 123rd Infantry', '555-0132', 'green.allen@army.mil', NULL, 0),
                (v_user_id, 'ADAMS', 'YOUNG', '', 'SSG', '11B', '1234567922', '1st Battalion, 123rd Infantry', '555-0133', 'adams.young@army.mil', 'Section Leader', 0),
                (v_user_id, 'BAKER', 'KING', 'I', 'SSG', '11B', '1234567923', '1st Battalion, 123rd Infantry', '555-0134', 'baker.king@army.mil', 'Section Leader', 0),
                (v_user_id, 'NELSON', 'WRIGHT', '', 'SSG', '11B', '1234567924', '1st Battalion, 123rd Infantry', '555-0135', 'nelson.wright@army.mil', NULL, 0),
                (v_user_id, 'CARTER', 'LOPEZ', 'J', 'SSG', '11B', '1234567925', '1st Battalion, 123rd Infantry', '555-0136', 'carter.lopez@army.mil', 'Section Leader', 0),
                (v_user_id, 'MITCHELL', 'HILL', '', 'SSG', '11B', '1234567926', '1st Battalion, 123rd Infantry', '555-0137', 'mitchell.hill@army.mil', NULL, 0),
                (v_user_id, 'PEREZ', 'SCOTT', 'K', 'SSG', '11B', '1234567927', '1st Battalion, 123rd Infantry', '555-0138', 'perez.scott@army.mil', NULL, 0),
                (v_user_id, 'ROBERTS', 'GREEN', '', 'SSG', '11B', '1234567928', '1st Battalion, 123rd Infantry', '555-0139', 'roberts.green@army.mil', NULL, 0),
                (v_user_id, 'TURNER', 'ADAMS', 'L', 'SSG', '11B', '1234567929', '1st Battalion, 123rd Infantry', '555-0140', 'turner.adams@army.mil', 'Section Leader', 0),
                
                -- Senior NCO (SFC - CSM) - 10 soldiers
                (v_user_id, 'PHILLIPS', 'CAMPBELL', '', 'SFC', '11B', '1234567930', '1st Battalion, 123rd Infantry', '555-0141', 'phillips.campbell@army.mil', 'Platoon Sergeant', 0),
                (v_user_id, 'CAMPBELL', 'PARKER', 'M', 'SFC', '11B', '1234567931', '1st Battalion, 123rd Infantry', '555-0142', 'campbell.parker@army.mil', 'Platoon Sergeant', 0),
                (v_user_id, 'EVANS', 'EVANS', '', 'SFC', '11B', '1234567932', '1st Battalion, 123rd Infantry', '555-0143', 'evans.evans@army.mil', NULL, 0),
                (v_user_id, 'EDWARDS', 'EDWARDS', 'N', 'SFC', '11B', '1234567933', '1st Battalion, 123rd Infantry', '555-0144', 'edwards.edwards@army.mil', 'Platoon Sergeant', 0),
                (v_user_id, 'COLLINS', 'COLLINS', '', 'SFC', '11B', '1234567934', '1st Battalion, 123rd Infantry', '555-0145', 'collins.collins@army.mil', NULL, 0),
                (v_user_id, 'STEWART', 'STEWART', 'O', 'MSG', '11B', '1234567935', '1st Battalion, 123rd Infantry', '555-0146', 'stewart.stewart@army.mil', 'Operations NCO', 0),
                (v_user_id, 'SANCHEZ', 'SANCHEZ', '', 'MSG', '11B', '1234567936', '1st Battalion, 123rd Infantry', '555-0147', 'sanchez.sanchez@army.mil', NULL, 0),
                (v_user_id, 'MORRIS', 'MORRIS', 'P', 'MSG', '11B', '1234567937', '1st Battalion, 123rd Infantry', '555-0148', 'morris.morris@army.mil', 'Operations NCO', 0),
                (v_user_id, 'ROGERS', 'ROGERS', '', '1SG', '11B', '1234567938', '1st Battalion, 123rd Infantry', '555-0149', 'rogers.rogers@army.mil', 'First Sergeant', 0),
                (v_user_id, 'REED', 'REED', 'Q', 'CSM', '11B', '1234567939', '1st Battalion, 123rd Infantry', '555-0150', 'reed.reed@army.mil', 'Command Sergeant Major', 0),
                
                -- Warrant Officers - 5 soldiers
                (v_user_id, 'COOK', 'COOK', '', 'WO1', '153A', '1234567940', '1st Battalion, 123rd Infantry', '555-0151', 'cook.cook@army.mil', 'Aviation Warrant', 0),
                (v_user_id, 'MORGAN', 'MORGAN', 'R', 'CW2', '153A', '1234567941', '1st Battalion, 123rd Infantry', '555-0152', 'morgan.morgan@army.mil', NULL, 0),
                (v_user_id, 'BELL', 'BELL', '', 'CW3', '153A', '1234567942', '1st Battalion, 123rd Infantry', '555-0153', 'bell.bell@army.mil', 'Aviation Warrant', 0),
                (v_user_id, 'MURPHY', 'MURPHY', 'S', 'CW4', '153A', '1234567943', '1st Battalion, 123rd Infantry', '555-0154', 'murphy.murphy@army.mil', NULL, 0),
                (v_user_id, 'BAILEY', 'BAILEY', '', 'CW5', '153A', '1234567944', '1st Battalion, 123rd Infantry', '555-0155', 'bailey.bailey@army.mil', 'Senior Aviation Warrant', 0),
                
                -- Officers - 10 soldiers
                (v_user_id, 'RIVERA', 'RIVERA', '', '2LT', '11A', '1234567945', '1st Battalion, 123rd Infantry', '555-0156', 'rivera.rivera@army.mil', 'Platoon Leader', 0),
                (v_user_id, 'COOPER', 'COOPER', 'T', '2LT', '11A', '1234567946', '1st Battalion, 123rd Infantry', '555-0157', 'cooper.cooper@army.mil', NULL, 0),
                (v_user_id, 'RICHARDSON', 'RICHARDSON', '', '1LT', '11A', '1234567947', '1st Battalion, 123rd Infantry', '555-0158', 'richardson.richardson@army.mil', 'Platoon Leader', 0),
                (v_user_id, 'COX', 'COX', 'U', '1LT', '11A', '1234567948', '1st Battalion, 123rd Infantry', '555-0159', 'cox.cox@army.mil', NULL, 0),
                (v_user_id, 'HOWARD', 'HOWARD', '', 'CPT', '11A', '1234567949', '1st Battalion, 123rd Infantry', '555-0160', 'howard.howard@army.mil', 'Company Commander', 0),
                (v_user_id, 'WARD', 'WARD', 'V', 'CPT', '11A', '1234567950', '1st Battalion, 123rd Infantry', '555-0161', 'ward.ward@army.mil', 'Company XO', 0),
                (v_user_id, 'TORRES', 'TORRES', '', 'MAJ', '11A', '1234567951', '1st Battalion, 123rd Infantry', '555-0162', 'torres.torres@army.mil', 'Battalion S3', 0),
                (v_user_id, 'PETERSON', 'PETERSON', 'W', 'MAJ', '11A', '1234567952', '1st Battalion, 123rd Infantry', '555-0163', 'peterson.peterson@army.mil', 'Battalion XO', 0),
                (v_user_id, 'GRAY', 'GRAY', '', 'LTC', '11A', '1234567953', '1st Battalion, 123rd Infantry', '555-0164', 'gray.gray@army.mil', 'Battalion Commander', 0),
                (v_user_id, 'RAMIREZ', 'RAMIREZ', 'X', 'COL', '11A', '1234567954', '1st Battalion, 123rd Infantry', '555-0165', 'ramirez.ramirez@army.mil', 'Regiment Commander', 0);
        
        -- Get count of inserted soldiers
        SELECT COUNT(*) INTO v_soldier_count FROM soldiers WHERE user_id = v_user_id;
        RAISE NOTICE 'Inserted % soldiers', v_soldier_count;
        
        -- Step 4: Insert realistic appointments
        -- Get soldier IDs using EDI numbers for unique identification (more reliable than names)
        SELECT id INTO v_smith_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567890' LIMIT 1;
        SELECT id INTO v_johnson_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567891' LIMIT 1;
        SELECT id INTO v_williams_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567892' LIMIT 1;
        SELECT id INTO v_brown_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567893' LIMIT 1;
        SELECT id INTO v_jones_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567894' LIMIT 1;
        SELECT id INTO v_garcia_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567895' LIMIT 1;
        SELECT id INTO v_miller_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567896' LIMIT 1;
        SELECT id INTO v_davis_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567897' LIMIT 1;
        SELECT id INTO v_rodriguez_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567898' LIMIT 1;
        SELECT id INTO v_martinez_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567899' LIMIT 1;
        SELECT id INTO v_hernandez_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567900' LIMIT 1;
        SELECT id INTO v_lopez_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567901' LIMIT 1;
        SELECT id INTO v_wilson_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567902' LIMIT 1;
        SELECT id INTO v_anderson_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567903' LIMIT 1;
        SELECT id INTO v_thomas_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567904' LIMIT 1;
        SELECT id INTO v_taylor_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567905' LIMIT 1;
        SELECT id INTO v_moore_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567906' LIMIT 1;
        SELECT id INTO v_jackson_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567907' LIMIT 1;
        SELECT id INTO v_white_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567908' LIMIT 1;
        SELECT id INTO v_harris_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567909' LIMIT 1;
        SELECT id INTO v_martin_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567910' LIMIT 1;
        SELECT id INTO v_thompson_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567911' LIMIT 1;
        SELECT id INTO v_garcia_cpl_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567912' LIMIT 1;
        SELECT id INTO v_martinez_cpl_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567913' LIMIT 1;
        SELECT id INTO v_robinson_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567914' LIMIT 1;
        SELECT id INTO v_clark_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567915' LIMIT 1;
        SELECT id INTO v_rodriguez_sgt_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567916' LIMIT 1;
        SELECT id INTO v_lewis_sgt_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567917' LIMIT 1;
        SELECT id INTO v_lee_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567918' LIMIT 1;
        SELECT id INTO v_walker_sgt_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567919' LIMIT 1;
        SELECT id INTO v_hall_sgt_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567920' LIMIT 1;
        SELECT id INTO v_allen_sgt_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567921' LIMIT 1;
        SELECT id INTO v_young_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567922' LIMIT 1;
        SELECT id INTO v_king_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567923' LIMIT 1;
        SELECT id INTO v_wright_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567924' LIMIT 1;
        SELECT id INTO v_lopez_ssg_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567925' LIMIT 1;
        SELECT id INTO v_hill_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567926' LIMIT 1;
        SELECT id INTO v_scott_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567927' LIMIT 1;
        SELECT id INTO v_green_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567928' LIMIT 1;
        SELECT id INTO v_adams_id FROM soldiers WHERE user_id = v_user_id AND edipi = '1234567929' LIMIT 1;
            
            -- Insert realistic appointments
            -- Leave (L) - various dates over next 3 months
            INSERT INTO soldier_appointments (soldier_id, user_id, start_date, end_date, reason, exception_code, notes)
            VALUES
                -- Leave blocks
                (v_smith_id, v_user_id, v_current_date + INTERVAL '5 days', v_current_date + INTERVAL '12 days', 'Leave', 'L', 'Family vacation'),
                (v_johnson_id, v_user_id, v_current_date + INTERVAL '20 days', v_current_date + INTERVAL '27 days', 'Leave', 'L', 'Personal leave'),
                (v_williams_id, v_user_id, v_current_date + INTERVAL '35 days', v_current_date + INTERVAL '42 days', 'Leave', 'L', NULL),
                (v_brown_id, v_user_id, v_current_date + INTERVAL '50 days', v_current_date + INTERVAL '57 days', 'Leave', 'L', 'Holiday block leave'),
                (v_jones_id, v_user_id, v_current_date + INTERVAL '65 days', v_current_date + INTERVAL '72 days', 'Leave', 'L', NULL),
                
                -- Training (T) - various dates
                (v_garcia_id, v_user_id, v_current_date + INTERVAL '8 days', v_current_date + INTERVAL '15 days', 'Training', 'T', 'Weapons qualification'),
                (v_miller_id, v_user_id, v_current_date + INTERVAL '25 days', v_current_date + INTERVAL '30 days', 'Training', 'T', 'NCOES'),
                (v_davis_id, v_user_id, v_current_date + INTERVAL '40 days', v_current_date + INTERVAL '47 days', 'Training', 'T', 'Advanced training course'),
                (v_rodriguez_id, v_user_id, v_current_date + INTERVAL '10 days', v_current_date + INTERVAL '12 days', 'Training', 'T', 'Range qualification'),
                
                -- TDY assignments
                (v_martinez_id, v_user_id, v_current_date + INTERVAL '15 days', v_current_date + INTERVAL '22 days', 'TDY', 'TDY', 'Temporary duty assignment'),
                (v_hernandez_id, v_user_id, v_current_date + INTERVAL '30 days', v_current_date + INTERVAL '37 days', 'TDY', 'TDY', 'Support mission'),
                (v_lopez_id, v_user_id, v_current_date + INTERVAL '45 days', v_current_date + INTERVAL '52 days', 'TDY', 'TDY', NULL),
                
                -- Medical appointments (A) - single day appointments
                (v_wilson_id, v_user_id, v_current_date + INTERVAL '7 days', v_current_date + INTERVAL '7 days', 'Medical Appointment', 'A', 'Annual physical'),
                (v_anderson_id, v_user_id, v_current_date + INTERVAL '14 days', v_current_date + INTERVAL '14 days', 'Medical Appointment', 'A', 'Dental cleaning'),
                (v_thomas_id, v_user_id, v_current_date + INTERVAL '21 days', v_current_date + INTERVAL '21 days', 'Medical Appointment', 'A', 'Follow-up appointment'),
                (v_taylor_id, v_user_id, v_current_date + INTERVAL '28 days', v_current_date + INTERVAL '28 days', 'Medical Appointment', 'A', NULL),
                (v_moore_id, v_user_id, v_current_date + INTERVAL '35 days', v_current_date + INTERVAL '35 days', 'Medical Appointment', 'A', 'Specialist consultation'),
                
                -- Appointments (A) - various reasons
                (v_jackson_id, v_user_id, v_current_date + INTERVAL '3 days', v_current_date + INTERVAL '3 days', 'Appointment', 'A', 'Vehicle registration'),
                (v_white_id, v_user_id, v_current_date + INTERVAL '11 days', v_current_date + INTERVAL '11 days', 'Appointment', 'A', 'Legal appointment'),
                (v_harris_id, v_user_id, v_current_date + INTERVAL '18 days', v_current_date + INTERVAL '18 days', 'Appointment', 'A', NULL),
                (v_martin_id, v_user_id, v_current_date + INTERVAL '24 days', v_current_date + INTERVAL '24 days', 'Appointment', 'A', 'Family matter'),
                
                -- NCO appointments
                (v_thompson_id, v_user_id, v_current_date + INTERVAL '12 days', v_current_date + INTERVAL '19 days', 'Leave', 'L', 'Block leave'),
                (v_garcia_cpl_id, v_user_id, v_current_date + INTERVAL '32 days', v_current_date + INTERVAL '39 days', 'Training', 'T', 'Leadership course'),
                (v_martinez_cpl_id, v_user_id, v_current_date + INTERVAL '6 days', v_current_date + INTERVAL '6 days', 'Appointment', 'A', 'Medical'),
                (v_robinson_id, v_user_id, v_current_date + INTERVAL '19 days', v_current_date + INTERVAL '19 days', 'Appointment', 'A', NULL),
                (v_clark_id, v_user_id, v_current_date + INTERVAL '26 days', v_current_date + INTERVAL '33 days', 'Leave', 'L', NULL),
                (v_rodriguez_sgt_id, v_user_id, v_current_date + INTERVAL '13 days', v_current_date + INTERVAL '13 days', 'Appointment', 'A', 'Dental'),
                (v_lewis_sgt_id, v_user_id, v_current_date + INTERVAL '38 days', v_current_date + INTERVAL '45 days', 'TDY', 'TDY', 'Training mission'),
                (v_lee_id, v_user_id, v_current_date + INTERVAL '9 days', v_current_date + INTERVAL '16 days', 'Training', 'T', 'NCO Academy'),
                (v_walker_sgt_id, v_user_id, v_current_date + INTERVAL '22 days', v_current_date + INTERVAL '22 days', 'Appointment', 'A', NULL),
                (v_hall_sgt_id, v_user_id, v_current_date + INTERVAL '29 days', v_current_date + INTERVAL '36 days', 'Leave', 'L', 'Personal'),
                (v_allen_sgt_id, v_user_id, v_current_date + INTERVAL '16 days', v_current_date + INTERVAL '16 days', 'Appointment', 'A', 'Medical'),
                (v_young_id, v_user_id, v_current_date + INTERVAL '42 days', v_current_date + INTERVAL '49 days', 'Leave', 'L', NULL),
                (v_king_id, v_user_id, v_current_date + INTERVAL '4 days', v_current_date + INTERVAL '11 days', 'Training', 'T', 'Weapons course'),
                (v_wright_id, v_user_id, v_current_date + INTERVAL '27 days', v_current_date + INTERVAL '27 days', 'Appointment', 'A', NULL),
                (v_lopez_ssg_id, v_user_id, v_current_date + INTERVAL '34 days', v_current_date + INTERVAL '41 days', 'TDY', 'TDY', 'Support detail'),
                (v_hill_id, v_user_id, v_current_date + INTERVAL '17 days', v_current_date + INTERVAL '17 days', 'Appointment', 'A', 'Medical'),
                (v_scott_id, v_user_id, v_current_date + INTERVAL '31 days', v_current_date + INTERVAL '38 days', 'Leave', 'L', NULL),
                (v_green_id, v_user_id, v_current_date + INTERVAL '23 days', v_current_date + INTERVAL '23 days', 'Appointment', 'A', NULL),
                (v_adams_id, v_user_id, v_current_date + INTERVAL '44 days', v_current_date + INTERVAL '51 days', 'Training', 'T', 'Advanced course');
        
        RAISE NOTICE 'Inserted realistic appointments';
        
        RAISE NOTICE 'Nuke and reseed completed successfully!';
        RAISE NOTICE 'Total soldiers: 65';
        RAISE NOTICE 'Total appointments: ~40';
        RAISE NOTICE 'All days_since_last_duty reset to 0';
    ELSE
        RAISE NOTICE 'User jacobwalker852@gmail.com not found. Please sign in first to create your account.';
    END IF;
END $$;

-- Verify the results
SELECT 
    s.rank,
    s.last_name,
    s.first_name,
    s.days_since_last_duty,
    COUNT(sa.id) as appointment_count
FROM soldiers s
LEFT JOIN soldier_appointments sa ON s.id = sa.soldier_id
WHERE s.user_id = (SELECT id FROM auth.users WHERE email = 'jacobwalker852@gmail.com')
GROUP BY s.id, s.rank, s.last_name, s.first_name, s.days_since_last_duty
ORDER BY s.rank, s.last_name
LIMIT 20;

