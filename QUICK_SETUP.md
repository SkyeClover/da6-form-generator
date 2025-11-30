# Quick Setup Guide

## Automated Setup (What I Can Do For You)

I've created the `.env` files with placeholders. Here's what you need to do:

## Step 1: Create Supabase Account & Project (5 minutes)

1. **Go to**: https://app.supabase.com
2. **Sign up** with your email (or log in if you have an account)
3. **Click "New Project"**
4. **Fill in**:
   - **Name**: `da6-form-generator`
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
5. **Click "Create new project"** and wait 2-3 minutes

## Step 2: Get Your API Keys (2 minutes)

1. In your Supabase dashboard, click **Settings** (gear icon) → **API**
2. You'll see:
   - **Project URL**: `https://xxxxx.supabase.co` (copy this)
   - **anon public** key: A long string starting with `eyJ...` (copy this)
   - **service_role** key: Another long string (copy this - keep it secret!)

## Step 3: Update Environment Variables (1 minute)

I've created the `.env` files. You just need to fill in the values:

### Root `.env` file:
```bash
# Edit this file: /home/jacobw/Documents/Projects/DA6 Form Gen/.env
SUPABASE_URL=paste_your_project_url_here
SUPABASE_SERVICE_ROLE_KEY=paste_your_service_role_key_here
```

### Client `.env` file:
```bash
# Edit this file: /home/jacobw/Documents/Projects/DA6 Form Gen/client/.env
REACT_APP_SUPABASE_URL=paste_your_project_url_here
REACT_APP_SUPABASE_ANON_KEY=paste_your_anon_key_here
```

## Step 4: Set Up Database Schema (2 minutes)

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Open the file: `database/schema.sql` from this project
3. **Copy the entire contents** of that file
4. **Paste** into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned"

## Step 5: Enable Google OAuth (5 minutes)

### A. Set up Google Cloud Console:

1. Go to https://console.cloud.google.com
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **OAuth consent screen**
   - Choose **External**
   - Fill in app name, support email
   - Click **Save and Continue**
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth client ID**
   - Type: **Web application**
   - Name: `DA6 Form Generator`
   - **Authorized redirect URIs**: 
     - Get this from Supabase: **Authentication** → **URL Configuration**
     - It will be: `https://your-project-ref.supabase.co/auth/v1/callback`
   - Click **Create**
6. **Copy the Client ID and Client Secret**

### B. Configure in Supabase:

1. In Supabase dashboard: **Authentication** → **Providers**
2. Find **Google** and toggle it **ON**
3. Paste your **Client ID** and **Client Secret** from Google
4. Click **Save**

### C. Set Redirect URLs:

1. In Supabase: **Authentication** → **URL Configuration**
2. **Site URL**: `http://localhost:3000`
3. **Redirect URLs**: Add `http://localhost:3000/**`
4. Click **Save**

## Step 6: Restart Dev Server

```bash
# Stop the current server (Ctrl+C if running)
# Then restart:
cd /home/jacobw/Documents/Projects/DA6\ Form\ Gen
npm run dev
```

## Step 7: Test It!

1. Open http://localhost:3000
2. You should see the login page
3. Click "Sign in with Google"
4. After signing in, you should see the dashboard!

---

## Need Help?

- See `SUPABASE_SETUP.md` for detailed instructions
- Run `./setup-supabase.sh` for an interactive guide

## Troubleshooting

**White page?** - Make sure you've added the environment variables and restarted the server.

**"Missing Supabase environment variables"?** - Check that your `.env` files are in the correct locations and have the right variable names.

**Google sign-in not working?** - Make sure you've added the correct redirect URI in Google Cloud Console (must match Supabase callback URL exactly).

