-- Comprehensive Seed Data for DA6 Form Generator
-- Adds approximately 60 soldiers with various ranks
-- Note: Replace 'USER_ID_HERE' with the actual user ID from auth.users table

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
        -- Insert comprehensive soldier data with various ranks
        INSERT INTO soldiers (user_id, first_name, last_name, middle_initial, rank, mos, edipi, unit, phone, email, notes, days_since_last_duty)
        VALUES
            -- Lower Enlisted (PVT - SPC) - 20 soldiers
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
            (v_user_id, 'ROBERTS', 'WHITE', '', 'SPC', '11B', '1234567908', '1st Battalion, 123rd Infantry', '555-0119', 'roberts.white@army.mil', NULL, 22),
            (v_user_id, 'THOMPSON', 'HARRIS', 'B', 'SPC', '11B', '1234567909', '1st Battalion, 123rd Infantry', '555-0120', 'thompson.harris@army.mil', NULL, 19),
            
            -- NCO Ranks (CPL - SSG) - 20 soldiers
            (v_user_id, 'JACKSON', 'MARTIN', '', 'CPL', '11B', '1234567910', '1st Battalion, 123rd Infantry', '555-0121', 'jackson.martin@army.mil', 'Team Leader', 28),
            (v_user_id, 'LEWIS', 'THOMPSON', 'C', 'CPL', '11B', '1234567911', '1st Battalion, 123rd Infantry', '555-0122', 'lewis.thompson@army.mil', NULL, 25),
            (v_user_id, 'WALKER', 'GARCIA', '', 'CPL', '11B', '1234567912', '1st Battalion, 123rd Infantry', '555-0123', 'walker.garcia@army.mil', NULL, 30),
            (v_user_id, 'HALL', 'MARTINEZ', 'D', 'CPL', '11B', '1234567913', '1st Battalion, 123rd Infantry', '555-0124', 'hall.martinez@army.mil', NULL, 27),
            (v_user_id, 'ALLEN', 'ROBINSON', '', 'CPL', '11B', '1234567914', '1st Battalion, 123rd Infantry', '555-0125', 'allen.robinson@army.mil', NULL, 24),
            (v_user_id, 'YOUNG', 'CLARK', 'E', 'SGT', '11B', '1234567915', '1st Battalion, 123rd Infantry', '555-0126', 'young.clark@army.mil', 'Squad Leader', 35),
            (v_user_id, 'KING', 'RODRIGUEZ', '', 'SGT', '11B', '1234567916', '1st Battalion, 123rd Infantry', '555-0127', 'king.rodriguez@army.mil', 'Squad Leader', 32),
            (v_user_id, 'WRIGHT', 'LEWIS', 'F', 'SGT', '11B', '1234567917', '1st Battalion, 123rd Infantry', '555-0128', 'wright.lewis@army.mil', NULL, 29),
            (v_user_id, 'LOPEZ', 'LEE', '', 'SGT', '11B', '1234567918', '1st Battalion, 123rd Infantry', '555-0129', 'lopez.lee@army.mil', 'Squad Leader', 33),
            (v_user_id, 'HILL', 'WALKER', 'G', 'SGT', '11B', '1234567919', '1st Battalion, 123rd Infantry', '555-0130', 'hill.walker@army.mil', NULL, 31),
            (v_user_id, 'SCOTT', 'HALL', '', 'SGT', '11B', '1234567920', '1st Battalion, 123rd Infantry', '555-0131', 'scott.hall@army.mil', NULL, 26),
            (v_user_id, 'GREEN', 'ALLEN', 'H', 'SGT', '11B', '1234567921', '1st Battalion, 123rd Infantry', '555-0132', 'green.allen@army.mil', NULL, 34),
            (v_user_id, 'ADAMS', 'YOUNG', '', 'SSG', '11B', '1234567922', '1st Battalion, 123rd Infantry', '555-0133', 'adams.young@army.mil', 'Section Leader', 40),
            (v_user_id, 'BAKER', 'KING', 'I', 'SSG', '11B', '1234567923', '1st Battalion, 123rd Infantry', '555-0134', 'baker.king@army.mil', 'Section Leader', 38),
            (v_user_id, 'NELSON', 'WRIGHT', '', 'SSG', '11B', '1234567924', '1st Battalion, 123rd Infantry', '555-0135', 'nelson.wright@army.mil', NULL, 36),
            (v_user_id, 'CARTER', 'LOPEZ', 'J', 'SSG', '11B', '1234567925', '1st Battalion, 123rd Infantry', '555-0136', 'carter.lopez@army.mil', 'Section Leader', 39),
            (v_user_id, 'MITCHELL', 'HILL', '', 'SSG', '11B', '1234567926', '1st Battalion, 123rd Infantry', '555-0137', 'mitchell.hill@army.mil', NULL, 37),
            (v_user_id, 'PEREZ', 'SCOTT', 'K', 'SSG', '11B', '1234567927', '1st Battalion, 123rd Infantry', '555-0138', 'perez.scott@army.mil', NULL, 41),
            (v_user_id, 'ROBERTS', 'GREEN', '', 'SSG', '11B', '1234567928', '1st Battalion, 123rd Infantry', '555-0139', 'roberts.green@army.mil', NULL, 42),
            (v_user_id, 'TURNER', 'ADAMS', 'L', 'SSG', '11B', '1234567929', '1st Battalion, 123rd Infantry', '555-0140', 'turner.adams@army.mil', 'Section Leader', 43),
            
            -- Senior NCO (SFC - CSM) - 10 soldiers
            (v_user_id, 'PHILLIPS', 'CAMPBELL', '', 'SFC', '11B', '1234567930', '1st Battalion, 123rd Infantry', '555-0141', 'phillips.campbell@army.mil', 'Platoon Sergeant', 50),
            (v_user_id, 'CAMPBELL', 'PARKER', 'M', 'SFC', '11B', '1234567931', '1st Battalion, 123rd Infantry', '555-0142', 'campbell.parker@army.mil', 'Platoon Sergeant', 48),
            (v_user_id, 'EVANS', 'EVANS', '', 'SFC', '11B', '1234567932', '1st Battalion, 123rd Infantry', '555-0143', 'evans.evans@army.mil', NULL, 45),
            (v_user_id, 'EDWARDS', 'EDWARDS', 'N', 'SFC', '11B', '1234567933', '1st Battalion, 123rd Infantry', '555-0144', 'edwards.edwards@army.mil', 'Platoon Sergeant', 47),
            (v_user_id, 'COLLINS', 'COLLINS', '', 'SFC', '11B', '1234567934', '1st Battalion, 123rd Infantry', '555-0145', 'collins.collins@army.mil', NULL, 46),
            (v_user_id, 'STEWART', 'STEWART', 'O', 'MSG', '11B', '1234567935', '1st Battalion, 123rd Infantry', '555-0146', 'stewart.stewart@army.mil', 'Operations NCO', 55),
            (v_user_id, 'SANCHEZ', 'SANCHEZ', '', 'MSG', '11B', '1234567936', '1st Battalion, 123rd Infantry', '555-0147', 'sanchez.sanchez@army.mil', NULL, 52),
            (v_user_id, 'MORRIS', 'MORRIS', 'P', 'MSG', '11B', '1234567937', '1st Battalion, 123rd Infantry', '555-0148', 'morris.morris@army.mil', 'Operations NCO', 53),
            (v_user_id, 'ROGERS', 'ROGERS', '', '1SG', '11B', '1234567938', '1st Battalion, 123rd Infantry', '555-0149', 'rogers.rogers@army.mil', 'First Sergeant', 60),
            (v_user_id, 'REED', 'REED', 'Q', 'CSM', '11B', '1234567939', '1st Battalion, 123rd Infantry', '555-0150', 'reed.reed@army.mil', 'Command Sergeant Major', 65),
            
            -- Warrant Officers - 5 soldiers
            (v_user_id, 'COOK', 'COOK', '', 'WO1', '153A', '1234567940', '1st Battalion, 123rd Infantry', '555-0151', 'cook.cook@army.mil', 'Aviation Warrant', 40),
            (v_user_id, 'MORGAN', 'MORGAN', 'R', 'CW2', '153A', '1234567941', '1st Battalion, 123rd Infantry', '555-0152', 'morgan.morgan@army.mil', NULL, 42),
            (v_user_id, 'BELL', 'BELL', '', 'CW3', '153A', '1234567942', '1st Battalion, 123rd Infantry', '555-0153', 'bell.bell@army.mil', 'Aviation Warrant', 45),
            (v_user_id, 'MURPHY', 'MURPHY', 'S', 'CW4', '153A', '1234567943', '1st Battalion, 123rd Infantry', '555-0154', 'murphy.murphy@army.mil', NULL, 48),
            (v_user_id, 'BAILEY', 'BAILEY', '', 'CW5', '153A', '1234567944', '1st Battalion, 123rd Infantry', '555-0155', 'bailey.bailey@army.mil', 'Senior Aviation Warrant', 50),
            
            -- Officers - 10 soldiers
            (v_user_id, 'RIVERA', 'RIVERA', '', '2LT', '11A', '1234567945', '1st Battalion, 123rd Infantry', '555-0156', 'rivera.rivera@army.mil', 'Platoon Leader', 20),
            (v_user_id, 'COOPER', 'COOPER', 'T', '2LT', '11A', '1234567946', '1st Battalion, 123rd Infantry', '555-0157', 'cooper.cooper@army.mil', NULL, 18),
            (v_user_id, 'RICHARDSON', 'RICHARDSON', '', '1LT', '11A', '1234567947', '1st Battalion, 123rd Infantry', '555-0158', 'richardson.richardson@army.mil', 'Platoon Leader', 25),
            (v_user_id, 'COX', 'COX', 'U', '1LT', '11A', '1234567948', '1st Battalion, 123rd Infantry', '555-0159', 'cox.cox@army.mil', NULL, 23),
            (v_user_id, 'HOWARD', 'HOWARD', '', 'CPT', '11A', '1234567949', '1st Battalion, 123rd Infantry', '555-0160', 'howard.howard@army.mil', 'Company Commander', 35),
            (v_user_id, 'WARD', 'WARD', 'V', 'CPT', '11A', '1234567950', '1st Battalion, 123rd Infantry', '555-0161', 'ward.ward@army.mil', 'Company XO', 32),
            (v_user_id, 'TORRES', 'TORRES', '', 'MAJ', '11A', '1234567951', '1st Battalion, 123rd Infantry', '555-0162', 'torres.torres@army.mil', 'Battalion S3', 40),
            (v_user_id, 'PETERSON', 'PETERSON', 'W', 'MAJ', '11A', '1234567952', '1st Battalion, 123rd Infantry', '555-0163', 'peterson.peterson@army.mil', 'Battalion XO', 38),
            (v_user_id, 'GRAY', 'GRAY', '', 'LTC', '11A', '1234567953', '1st Battalion, 123rd Infantry', '555-0164', 'gray.gray@army.mil', 'Battalion Commander', 45),
            (v_user_id, 'RAMIREZ', 'RAMIREZ', 'X', 'COL', '11A', '1234567954', '1st Battalion, 123rd Infantry', '555-0165', 'ramirez.ramirez@army.mil', 'Regiment Commander', 50)
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Comprehensive seed data inserted for user: %', v_user_id;
        RAISE NOTICE 'Total soldiers inserted: 65 (20 Lower Enlisted, 20 NCO, 10 Senior NCO, 5 Warrant Officers, 10 Officers)';
    ELSE
        RAISE NOTICE 'User jacobwalker852@gmail.com not found. Please sign in first to create your account.';
    END IF;
END $$;

