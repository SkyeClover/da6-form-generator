# Seed Data Instructions

## Adding Sample Soldiers

To add fake soldiers to your account for testing:

1. **Sign in to your app** first (jacobwalker852@gmail.com)
   - This creates your user account in Supabase

2. **Get your User ID**:
   - Go to Supabase Dashboard: https://supabase.com/dashboard/project/emutqazwbtikbvvopxpl
   - Go to **Authentication** → **Users**
   - Find your email (jacobwalker852@gmail.com)
   - Copy your User ID (it's a UUID like `123e4567-e89b-12d3-a456-426614174000`)

3. **Run the seed data script**:
   - Go to **SQL Editor** in Supabase
   - Open the file `database/seed_data.sql`
   - The script will automatically find your user by email and insert 20 sample soldiers
   - Click **Run**

4. **Verify the data**:
   - Go back to your app
   - Navigate to **Soldiers** page
   - You should see 20 fake soldiers with various ranks (PVT, PV2, PFC, SGT, SSG)

## Sample Soldiers Included

The seed data includes:
- 8x PVT (Private) soldiers
- 4x PV2 (Private Second Class) soldiers  
- 6x PFC (Private First Class) soldiers
- 1x SGT (Sergeant)
- 1x SSG (Staff Sergeant)

All soldiers are assigned to "1st Battalion, 123rd Infantry" with realistic names, EDIPIs, and contact information.

## Alternative: Manual Insert

If you prefer to insert manually, you can use the Supabase Table Editor:
1. Go to **Table Editor** → **soldiers**
2. Click **Insert** → **Insert row**
3. Fill in the fields for each soldier

