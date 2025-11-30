# How to Find Your Supabase Credentials

This guide shows you exactly where to find all the values you need for Vercel deployment.

## Step 1: Access Your Supabase Dashboard

1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your DA6 Form Generator project (or create one if you haven't)

## Step 2: Find Your Supabase Credentials

### Finding SUPABASE_URL and SUPABASE_ANON_KEY

1. In your Supabase project dashboard, look at the **left sidebar**
2. Click on **Settings** (gear icon at the bottom)
3. Click on **API** in the settings menu
4. You'll see a section called **Project API keys**

Here you'll find:

#### **Project URL** → Use for `SUPABASE_URL` and `REACT_APP_SUPABASE_URL`
- This looks like: `https://xxxxxxxxxxxxx.supabase.co`
- Copy this entire URL

#### **anon public** key → Use for `REACT_APP_SUPABASE_ANON_KEY`
- This is a long string starting with `eyJ...`
- Click the **eye icon** or **reveal** button to see it
- Copy the entire key

#### **service_role** key → Use for `SUPABASE_SERVICE_ROLE_KEY`
- ⚠️ **IMPORTANT**: This is a SECRET key - never share it publicly!
- This is also a long string starting with `eyJ...`
- Click the **eye icon** or **reveal** button to see it
- Copy the entire key
- Keep this secure - it bypasses Row Level Security

### Visual Guide:

```
Supabase Dashboard
├── Settings (gear icon)
    └── API
        ├── Project URL: https://xxxxx.supabase.co  ← SUPABASE_URL
        ├── Project API keys:
        │   ├── anon public: eyJhbGc...  ← REACT_APP_SUPABASE_ANON_KEY
        │   └── service_role: eyJhbGc... ← SUPABASE_SERVICE_ROLE_KEY (SECRET!)
```

## Step 3: Configure Supabase Auth URLs

You need to tell Supabase which URLs are allowed to use authentication.

### Finding the Auth URL Configuration:

1. In your Supabase project dashboard, click on **Authentication** in the left sidebar
2. Click on **URL Configuration** (or look for "Site URL" and "Redirect URLs" sections)

### What to Add:

#### **Site URL**:
- Add your Vercel URL: `https://your-app.vercel.app`
- Replace `your-app` with your actual Vercel project name
- Example: `https://da6-form-generator.vercel.app`

#### **Redirect URLs**:
Add these URLs (one per line):
```
https://your-app.vercel.app
https://your-app.vercel.app/**
https://your-app-*.vercel.app
```

**Note**: 
- The `/**` allows all paths on your domain
- The `*` pattern allows preview deployments (for pull requests)

### Example:
If your Vercel app is `https://da6-form-generator.vercel.app`, add:
```
https://da6-form-generator.vercel.app
https://da6-form-generator.vercel.app/**
https://da6-form-generator-*.vercel.app
```

## Step 4: Finding Your Vercel URL

After you deploy to Vercel:

1. Go to your Vercel dashboard
2. Click on your project
3. You'll see your deployment URL at the top
4. It will look like: `https://your-project-name.vercel.app`
5. Copy this URL - you'll need it for:
   - `CLIENT_URL` environment variable
   - Supabase Auth URL configuration

## Quick Reference: Where Each Value Goes

### In Vercel Environment Variables:

| Variable Name | Where to Find It | Example Value |
|--------------|------------------|---------------|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `REACT_APP_SUPABASE_URL` | Same as SUPABASE_URL | `https://xxxxx.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `CLIENT_URL` | Your Vercel deployment URL | `https://your-app.vercel.app` |

### In Supabase Auth Configuration:

| Setting | What to Add |
|---------|-------------|
| Site URL | Your Vercel URL: `https://your-app.vercel.app` |
| Redirect URLs | `https://your-app.vercel.app`<br>`https://your-app.vercel.app/**`<br>`https://your-app-*.vercel.app` |

## Troubleshooting

### "I can't see my API keys"
- Make sure you're logged into the correct Supabase project
- Check that you have admin/owner permissions
- Try refreshing the page

### "Where is the URL Configuration?"
- It's under **Authentication** → **URL Configuration**
- Some Supabase versions call it "Auth" → "Settings" → "URLs"
- Look for "Site URL" and "Redirect URLs" fields

### "I don't have a Vercel URL yet"
- Deploy to Vercel first (even without env vars)
- Vercel will give you a URL immediately
- You can update Supabase settings after deployment

### "The keys are hidden"
- Click the eye icon (👁️) or "Reveal" button next to the key
- Some keys might be partially hidden - click to reveal fully

## Security Reminders

⚠️ **Never commit these to Git:**
- `SUPABASE_SERVICE_ROLE_KEY` - This is a secret key!
- Any `.env` files

✅ **Safe to commit:**
- `vercel.json`
- Configuration files (they don't contain secrets)

## Next Steps

Once you have all these values:

1. Add them to Vercel environment variables (see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md))
2. Update Supabase Auth URLs
3. Redeploy your Vercel app
4. Test authentication

Need more help? Check the [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) guide for detailed deployment steps.

