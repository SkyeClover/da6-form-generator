# Unit Migration Guide

## Days Since Last Duty Tracking

When units migrate to this system, it's important to maintain accurate "days since last duty" tracking for each soldier. This ensures fair duty distribution and prevents resetting everyone's duty history.

## How to Migrate Your Unit

### Step 1: Add Your Soldiers

1. Go to the **Soldiers** page
2. Add all soldiers in your unit
3. For each soldier, enter their **Days Since Last Duty** when creating/editing

### Step 2: Bulk Update (Recommended)

If you have many soldiers, use the **Bulk Update Days Since Last Duty** button:

1. Click "Bulk Update Days Since Last Duty" on the Soldiers page
2. Enter the current days since last duty for each soldier
3. Click "Update All"

This is much faster than editing each soldier individually.

### Step 3: Verify

1. Check the Soldiers table - you should see a "Days Since Last Duty" column
2. Days are color-coded:
   - **Green (0-7 days)**: Recently had duty
   - **Yellow (8-14 days)**: Medium priority
   - **Red (15+ days)**: High priority (should be scheduled soon)

## Database Migration

If you already ran the schema.sql, you need to add the new column:

1. Go to Supabase SQL Editor
2. Run `database/migration_add_days_since_duty.sql`
3. This adds the `days_since_last_duty` column to existing soldiers tables

## Best Practices

- **Track accurately**: Enter the actual days since last duty from your previous system
- **Update regularly**: The system will track this going forward, but initial entry is critical
- **Use bulk update**: For units with many soldiers, use the bulk update feature
- **Verify data**: Double-check a few soldiers to ensure data migrated correctly

## Future Enhancements

The system will automatically update days since last duty when:
- New DA6 forms are created and completed
- Soldiers are assigned duty
- Forms are finalized

This ensures ongoing accurate tracking without manual updates.

