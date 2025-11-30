# Vercel Deployment Guide

This guide will help you deploy the DA6 Form Generator to Vercel so you can share it with your co-workers for testing.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com) - free tier is fine)
2. A Supabase project already set up (see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md))
3. Your Supabase credentials ready

## Step 1: Prepare Your Repository

Make sure all your changes are committed and pushed to a Git repository (GitHub, GitLab, or Bitbucket).

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended for first time)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your Git repository
4. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: Leave as default (root)
   - **Build Command**: `cd client && npm install && npm run build`
   - **Output Directory**: `client/build`
   - **Install Command**: `npm install && cd client && npm install`

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Follow the prompts:
   - Link to existing project? No (first time)
   - Project name: `da6-form-generator` (or your choice)
   - Directory: `./`
   - Override settings? No

## Step 3: Configure Environment Variables

After deployment, you need to add environment variables in Vercel:

1. Go to your project dashboard on Vercel
2. Click on **Settings** → **Environment Variables**
3. Add the following variables:

### Required Environment Variables:

#### For the Server (API):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (keep this secret!)
- `CLIENT_URL` - Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

#### For the Client (React App):
- `REACT_APP_SUPABASE_URL` - Your Supabase project URL (same as above)
- `REACT_APP_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key

### How to Add Environment Variables:

1. In Vercel dashboard, go to **Settings** → **Environment Variables**
2. Click **Add New**
3. For each variable:
   - **Key**: Enter the variable name (e.g., `SUPABASE_URL`)
   - **Value**: Enter the value
   - **Environment**: Select all (Production, Preview, Development)
   - Click **Save**

### Finding Your Supabase Credentials:

1. Go to your Supabase project dashboard
2. Click on **Settings** → **API**
3. You'll find:
   - **Project URL** → Use for `SUPABASE_URL` and `REACT_APP_SUPABASE_URL`
   - **anon/public key** → Use for `REACT_APP_SUPABASE_ANON_KEY`
   - **service_role key** → Use for `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

## Step 4: Update Supabase Auth Settings

You need to add your Vercel URL to Supabase's allowed redirect URLs:

1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add your Vercel URL to **Redirect URLs**:
   - `https://your-app.vercel.app`
   - `https://your-app.vercel.app/**`
   - `https://your-app-*.vercel.app` (for preview deployments)

3. Add your Vercel URL to **Site URL**:
   - `https://your-app.vercel.app`

## Step 5: Redeploy

After adding environment variables:

1. Go to **Deployments** tab in Vercel
2. Click the **⋯** menu on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger automatic deployment

## Step 6: Test Your Deployment

1. Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Test the following:
   - ✅ App loads without errors
   - ✅ Login with Google OAuth works
   - ✅ Can create/view soldiers
   - ✅ Can create/view DA6 forms
   - ✅ API endpoints respond correctly

## Troubleshooting

### Issue: "Failed to fetch" errors
- **Solution**: Check that `CLIENT_URL` environment variable matches your Vercel URL
- Check browser console for CORS errors
- Verify Supabase redirect URLs are configured correctly

### Issue: Authentication not working
- **Solution**: 
  - Verify `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` are set
  - Check Supabase redirect URLs include your Vercel domain
  - Check browser console for auth errors

### Issue: API routes return 404
- **Solution**: 
  - Verify `vercel.json` is in the root directory
  - Check that `api/index.js` exists and exports the Express app
  - Check Vercel function logs in the dashboard

### Issue: Build fails
- **Solution**:
  - Check build logs in Vercel dashboard
  - Ensure all dependencies are in `package.json`
  - Verify Node.js version (Vercel uses Node 18.x by default)

### Viewing Logs:
- Go to **Deployments** → Click on a deployment → **Functions** tab
- Click on a function to see logs

## Sharing with Co-workers

Once deployed:

1. Share your Vercel URL: `https://your-app.vercel.app`
2. They can access it from any device/browser
3. They'll need to sign in with Google OAuth (make sure their emails are allowed in Supabase if you have email restrictions)

## Continuous Deployment

Vercel automatically deploys when you push to your main branch:
- **Production**: Deploys from `main` or `master` branch
- **Preview**: Creates preview deployments for pull requests

## Next Steps

- Set up a custom domain (optional)
- Configure email notifications for deployments
- Set up monitoring and analytics
- Review Vercel's usage limits on the free tier

## Security Notes

⚠️ **Important**:
- Never commit `.env` files or environment variables to Git
- The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security - keep it secret!
- Review Supabase RLS policies to ensure data security
- Consider setting up Supabase email allowlist for production

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for client-side errors
3. Review Supabase logs in the Supabase dashboard
4. Check that all environment variables are set correctly

