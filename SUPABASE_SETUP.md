# Supabase Setup Guide

This guide will help you set up Supabase for the DA6 Form Generator application.

## 1. Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in your project details:
   - Name: `da6-form-generator` (or your preferred name)
   - Database Password: Create a strong password (save this!)
   - Region: Choose the closest region to your users
5. Click "Create new project" and wait for it to initialize

## 2. Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. You'll need:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys" → "anon public")
   - **service_role key** (under "Project API keys" → "service_role" - keep this secret!)

## 3. Set Up Environment Variables

### Server (.env)
Create a `.env` file in the root directory:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
SUPABASE_URL=your_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Client (.env)
Create a `.env` file in the `client` directory:

```env
REACT_APP_SUPABASE_URL=your_project_url_here
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
```

## 4. Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Open the file `database/schema.sql` from this project
3. Copy the entire contents
4. Paste it into the SQL Editor
5. Click "Run" to execute the schema

This will create:
- `user_profiles` table
- `soldiers` table
- `da6_forms` table
- Row Level Security (RLS) policies
- Triggers for automatic profile creation

## 5. Enable Google OAuth

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** in the list
3. Toggle it to **Enabled**
4. You'll need to set up Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google+ API
   - Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: Add your Supabase callback URL:
     ```
     https://your-project-ref.supabase.co/auth/v1/callback
     ```
     (Find your exact callback URL in Supabase: **Authentication** → **URL Configuration**)
   - Copy the **Client ID** and **Client Secret**
5. Back in Supabase, paste the Client ID and Client Secret
6. Click **Save**

## 6. Configure Redirect URLs

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Add your site URL:
   - Site URL: `http://localhost:3000` (for development)
   - Redirect URLs: Add `http://localhost:3000/**`

## 7. Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```
2. Navigate to `http://localhost:3000`
3. You should see the login page
4. Click "Sign in with Google"
5. After authentication, you should be redirected to the dashboard

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure you've created `.env` files in both root and `client` directories
- Restart your development server after adding environment variables

### "Invalid API key"
- Double-check that you copied the correct keys from Supabase
- Make sure there are no extra spaces or quotes in your `.env` files

### Google OAuth not working
- Verify your redirect URI matches exactly in both Google Console and Supabase
- Make sure Google+ API is enabled in Google Cloud Console
- Check that OAuth consent screen is configured in Google Cloud Console

### Database errors
- Make sure you ran the schema.sql file in the SQL Editor
- Check that RLS policies are enabled (they should be created by the schema)

## Security Notes

- **Never commit `.env` files to git** (they're already in `.gitignore`)
- The `service_role` key has admin access - keep it secret!
- The `anon` key is safe to use in client-side code (RLS policies protect your data)

## Next Steps

Once Supabase is set up, you can:
- Start adding soldiers/personnel
- Create DA6 forms
- Manage user profiles

For more information, see the [Supabase Documentation](https://supabase.com/docs).

