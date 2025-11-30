# DA6 Form Generator - Implementation Summary

This document summarizes the changes made to implement the requirements from Walker DA6 notes.

## ✅ Completed Features

### 1. Rank Ordering & Sorting
- **Created**: `client/src/utils/rankOrder.js`
- **Features**:
  - Proper rank hierarchy from lowest (PVT) to highest (GEN)
  - Sort soldiers by rank (lowest to highest), then alphabetically by last name, then first name
  - Helper functions to identify rank categories (lower enlisted, NCO, warrant officer, officer)
- **Updated Components**: 
  - `DA6Form.js` - Uses sorted soldiers
  - `Soldiers.js` - Displays soldiers in proper order
  - `DA6FormView.js` - Shows roster in proper order

### 2. Duty Configuration
- **Added Fields**:
  - Nature of duty (name of duty)
  - Soldiers per day
  - Days off after duty
  - Weekend handling options
  - Separate weekend/holiday cycle options
- **Location**: `DA6Form.js` - New "Duty Configuration" section

### 3. Weekend and Holiday Handling
- **Features**:
  - Option to skip/don't skip weekends
  - Separate weekend cycle option (treat weekends as separate roster)
  - Separate holiday cycle option (treat holidays as separate roster)
  - Holiday management (add/edit/delete holidays)
- **Database**: New `holidays` table (see migration file)
- **API**: New `/api/holidays` endpoints

### 4. Default Duty Templates
- **Created**: `client/src/utils/dutyTemplates.js`
- **Templates**:
  - CQ (Charge of Quarters) - 1 SGT/CPL, 1 lower enlisted
  - BN Staff Duty - 1 SGT/CPL/SSG, 1 lower enlisted
  - Brigade Staff Duty - 1 SFC, 2 lower enlisted, 1 officer/warrant
  - CORP - 1 SFC/MSG, 2 lower enlisted
  - Custom - User-defined

### 5. Cross-Roster Checking
- **Features**:
  - Check if soldiers are already assigned to other rosters
  - Auto-apply exception codes (CQ, SD, D) when conflicts are found
  - Select which rosters to check against
- **Location**: `DA6Form.js` - New "Cross-Roster Checking" section

### 6. Excluded Dates
- **Feature**: Mark dates where no one is needed from the roster
- **Location**: `DA6Form.js` - "Holidays & Excluded Dates" section
- **Visual**: Excluded dates are marked with ✗ in the exceptions table

### 7. Database Updates
- **Migration File**: `database/migration_add_holidays_and_duty_config.sql`
- **New Table**: `holidays` - Stores user-defined holidays
- **Updated**: `da6_forms.form_data` JSONB now stores:
  - `duty_config` - Duty configuration settings
  - `holidays` - Array of holiday dates
  - `excluded_dates` - Array of excluded dates

### 8. API Updates
- **New Endpoints** (in `server/index.js`):
  - `GET /api/holidays` - Get all holidays
  - `POST /api/holidays` - Create holiday
  - `PUT /api/holidays/:id` - Update holiday
  - `DELETE /api/holidays/:id` - Delete holiday

## 📋 Implementation Details

### Rank Ordering
The rank ordering follows standard Army hierarchy:
- Enlisted: PVT → PV2 → PFC → SPC → CPL → SGT → SSG → SFC → MSG → 1SG → SGM → CSM
- Warrant Officers: WO1 → CW2 → CW3 → CW4 → CW5
- Officers: 2LT → 1LT → CPT → MAJ → LTC → COL → BG → MG → LTG → GEN

### Weekend/Holiday Logic
- If `skip_weekends` is true, weekends are excluded from duty assignments
- If `separate_weekend_cycle` is true, weekends are treated as a separate roster (future enhancement for tracking)
- If `separate_holiday_cycle` is true, holidays are treated as a separate roster (future enhancement for tracking)
- Excluded dates always skip duty assignments regardless of other settings

### Cross-Roster Checking
- Checks selected rosters for soldier assignments on overlapping dates
- Automatically applies appropriate exception codes:
  - `CQ` if conflict is with CQ duty
  - `SD` if conflict is with Staff Duty
  - `D` (Detail) for other conflicts

## 🚀 Next Steps

To use these new features:

1. **Run Database Migration**:
   ```sql
   -- Run in Supabase SQL editor
   -- See: database/migration_add_holidays_and_duty_config.sql
   ```

2. **Restart Server**: The server needs to be restarted to pick up new API endpoints

3. **Use New Features**:
   - Create/edit a DA6 form to see the new Duty Configuration section
   - Add holidays in the "Holidays & Excluded Dates" section
   - Enable cross-roster checking to avoid double-booking soldiers
   - Use duty templates for quick setup

## 📝 Notes

- All existing forms will continue to work (backward compatible)
- Default duty config is applied if not specified in existing forms
- Holiday management is integrated with the form, but can also be managed separately via API
- Cross-roster checking requires at least one other form to exist

