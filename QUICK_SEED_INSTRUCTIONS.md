# Quick Seed Data Instructions

## How to Add Sample Soldiers

### Step 1: Open the Seed Data File
1. Open the file: `database/seed_data.sql` in your code editor
2. **Copy the entire contents** of that file (Ctrl+A, then Ctrl+C)

### Step 2: Run in Supabase SQL Editor
1. In your Supabase dashboard, you're already in the **SQL Editor** (I can see it in your screenshot)
2. Click the **"New Query"** button (or create a new tab)
3. **Paste** the entire seed_data.sql contents into the editor
4. Click the green **"Run"** button (or press Ctrl+Enter)

### Step 3: Verify
1. The query should run successfully
2. You should see a message like "Seed data inserted for user: [your-user-id]"
3. Go back to your app and navigate to the **Soldiers** page
4. You should see 20 sample soldiers!

## Important Notes

- **Make sure you're signed in** to your app first (jacobwalker852@gmail.com)
  - This creates your user account in Supabase
  - The seed script needs your account to exist

- If you get an error saying "User not found":
  - Sign in to your app first at http://localhost:3000
  - Then try running the seed script again

## Alternative: Copy-Paste Method

If you prefer, here's the SQL you can copy directly:

```sql
-- (The full SQL from seed_data.sql)
```

Just copy the entire contents of `database/seed_data.sql` and paste it into the Supabase SQL Editor, then click Run!

