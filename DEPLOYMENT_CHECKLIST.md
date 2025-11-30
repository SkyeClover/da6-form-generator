# Quick Deployment Checklist

Use this checklist when deploying to Vercel for the first time.

## Pre-Deployment

- [ ] Code is committed and pushed to Git repository
- [ ] All tests pass locally
- [ ] Supabase project is set up and database schema is applied
- [ ] You have your Supabase credentials ready:
  - [ ] Project URL
  - [ ] Anon/Public Key
  - [ ] Service Role Key

## Vercel Setup

- [ ] Create Vercel account (if needed)
- [ ] Import Git repository to Vercel
- [ ] Configure project settings:
  - [ ] Framework: Other
  - [ ] Build Command: `cd client && npm install && npm run build`
  - [ ] Output Directory: `client/build`
  - [ ] Install Command: `npm install && cd client && npm install`

## Environment Variables

> 📖 **Need help finding these values?** See [FINDING_SUPABASE_CREDENTIALS.md](./FINDING_SUPABASE_CREDENTIALS.md) for step-by-step instructions!

Add these in Vercel Dashboard → Settings → Environment Variables:

### Server Variables:
- [ ] `SUPABASE_URL` = Your Supabase project URL
  - Find it: Supabase Dashboard → Settings → API → Project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = Your Supabase service role key
  - Find it: Supabase Dashboard → Settings → API → service_role key (⚠️ Secret!)
- [ ] `CLIENT_URL` = Your Vercel URL (e.g., `https://your-app.vercel.app`)
  - Find it: Vercel Dashboard → Your Project → Copy the URL at the top

### Client Variables:
- [ ] `REACT_APP_SUPABASE_URL` = Your Supabase project URL
  - Same as SUPABASE_URL above
- [ ] `REACT_APP_SUPABASE_ANON_KEY` = Your Supabase anon/public key
  - Find it: Supabase Dashboard → Settings → API → anon public key

## Supabase Configuration

> 📖 **Detailed instructions:** See [FINDING_SUPABASE_CREDENTIALS.md](./FINDING_SUPABASE_CREDENTIALS.md) section "Step 3"

- [ ] Go to Supabase Dashboard → Authentication → URL Configuration
- [ ] Add Vercel URL to Supabase Auth → URL Configuration:
  - [ ] Site URL: `https://your-app.vercel.app`
  - [ ] Redirect URLs: Add these (one per line):
    - `https://your-app.vercel.app`
    - `https://your-app.vercel.app/**`
    - `https://your-app-*.vercel.app`

## Post-Deployment

- [ ] Redeploy after adding environment variables
- [ ] Test the deployment:
  - [ ] App loads without errors
  - [ ] Google OAuth login works
  - [ ] Can create/view soldiers
  - [ ] Can create/view DA6 forms
  - [ ] API endpoints respond correctly

## Sharing

- [ ] Copy your Vercel URL
- [ ] Share with co-workers: `https://your-app.vercel.app`
- [ ] Let them know they need to sign in with Google OAuth

## Troubleshooting

If something doesn't work:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Check Supabase logs
5. Review [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for detailed troubleshooting

