# Enable Google OAuth - Quick Guide

The error "Unsupported provider: provider is not enabled" means Google OAuth isn't set up yet in Supabase.

## Quick Fix (2 Options):

### Option 1: Enable Email Auth (Quickest - No Google Setup Needed)

If you just want to test the app quickly, you can use email authentication:

1. Go to: https://supabase.com/dashboard/project/emutqazwbtikbvvopxpl/auth/providers
2. Find **Email** provider (should already be enabled)
3. Make sure it's toggled **ON**
4. In your app, you can sign in with email/password instead of Google

**Note:** You'll need to update the login component to support email auth, or we can add that.

---

### Option 2: Enable Google OAuth (Recommended)

#### Step 1: Google Cloud Console Setup (5 minutes)

1. **Go to**: https://console.cloud.google.com
2. **Create/Select Project**:
   - Click project dropdown at top
   - Click "New Project" or select existing
   - Name: `DA6 Form Generator` (or your choice)
   - Click "Create"

3. **Configure OAuth Consent Screen**:
   - Go to **APIs & Services** → **OAuth consent screen**
   - Choose **External** → Click **Create**
   - Fill in:
     - **App name**: `DA6 Form Generator`
     - **User support email**: Your email
     - **Developer contact**: Your email
   - Click **Save and Continue**
   - On "Scopes" page, click **Save and Continue**
   - On "Test users" page, click **Save and Continue**
   - On "Summary" page, click **Back to Dashboard**

4. **Create OAuth Credentials**:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `DA6 Form Generator Web`
   - **Authorized redirect URIs**: Add this EXACT URL:
     ```
     https://emutqazwbtikbvvopxpl.supabase.co/auth/v1/callback
     ```
   - Click **Create**
   - **IMPORTANT**: Copy the **Client ID** and **Client Secret** (you'll need these next)

#### Step 2: Configure in Supabase (2 minutes)

1. **Go to Supabase Dashboard**:
   - https://supabase.com/dashboard/project/emutqazwbtikbvvopxpl/auth/providers

2. **Enable Google Provider**:
   - Find **Google** in the list
   - Toggle it **ON** (switch to the right)
   - Paste your **Client ID** from Google Cloud Console
   - Paste your **Client Secret** from Google Cloud Console
   - Click **Save**

3. **Set Redirect URLs**:
   - Go to: https://supabase.com/dashboard/project/emutqazwbtikbvvopxpl/auth/url-configuration
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: Add `http://localhost:3000/**`
   - Click **Save**

#### Step 3: Test It!

1. Go back to your app: http://localhost:3000
2. Click "Sign in with Google"
3. You should be redirected to Google sign-in
4. After signing in, you'll be redirected back to your app

---

## Troubleshooting

**"Redirect URI mismatch" error?**
- Make sure the redirect URI in Google Console EXACTLY matches:
  `https://emutqazwbtikbvvopxpl.supabase.co/auth/v1/callback`
- No trailing slashes, exact match required

**Still getting "provider is not enabled"?**
- Make sure you clicked **Save** in Supabase after enabling Google
- Try refreshing the page
- Check that the toggle is actually ON (green/blue)

**Want to use email auth instead?**
- Email provider should already be enabled in Supabase
- We can update the login component to support email/password if you prefer

