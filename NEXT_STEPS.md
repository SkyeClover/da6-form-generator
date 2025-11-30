# Next Steps - Almost Done! 🎉

Your Supabase credentials have been configured! Here's what to do next:

## ✅ Step 1: Set Up Database Schema (REQUIRED)

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/emutqazwbtikbvvopxpl
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `database/schema.sql` from this project
5. **Copy the entire contents** of that file
6. **Paste** it into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. You should see "Success" message

This creates:
- `user_profiles` table
- `soldiers` table  
- `da6_forms` table
- Security policies (RLS)
- Automatic triggers

## ✅ Step 2: Restart Your Dev Server

The server needs to be restarted to pick up the new environment variables:

```bash
# Stop the current server (press Ctrl+C in the terminal where it's running)
# Then restart:
cd /home/jacobw/Documents/Projects/DA6\ Form\ Gen
npm run dev
```

## ✅ Step 3: Test the App

1. Open http://localhost:3000 in your browser
2. You should now see the **Login page** (not the setup screen!)
3. The app is ready to use (though Google OAuth still needs to be configured)

## 🔐 Step 4: Set Up Google OAuth (Optional but Recommended)

To enable "Sign in with Google":

### A. Google Cloud Console Setup:

1. Go to https://console.cloud.google.com
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **OAuth consent screen**
   - Choose **External**
   - Fill in app name: `DA6 Form Generator`
   - Support email: your email
   - Click **Save and Continue**
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth client ID**
   - Type: **Web application**
   - Name: `DA6 Form Generator`
   - **Authorized redirect URIs**: 
     ```
     https://emutqazwbtikbvvopxpl.supabase.co/auth/v1/callback
     ```
   - Click **Create**
6. **Copy the Client ID and Client Secret**

### B. Configure in Supabase:

1. Go to: https://supabase.com/dashboard/project/emutqazwbtikbvvopxpl/auth/providers
2. Find **Google** and toggle it **ON**
3. Paste your **Client ID** and **Client Secret** from Google
4. Click **Save**

### C. Set Redirect URLs in Supabase:

1. Go to: https://supabase.com/dashboard/project/emutqazwbtikbvvopxpl/auth/url-configuration
2. **Site URL**: `http://localhost:3000`
3. **Redirect URLs**: Add `http://localhost:3000/**`
4. Click **Save**

## 🎉 You're Done!

After completing these steps:
- The app will work with authentication
- You can sign in with Google
- You can start creating DA6 forms and managing soldiers

---

**Note**: The app will work even without Google OAuth - you just won't be able to sign in yet. But the database and API are ready to go!

