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

Add these in Vercel Dashboard → Settings → Environment Variables:

### Server Variables:
- [ ] `SUPABASE_URL` = Your Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = Your Supabase service role key
- [ ] `CLIENT_URL` = Your Vercel URL (e.g., `https://your-app.vercel.app`)

### Client Variables:
- [ ] `REACT_APP_SUPABASE_URL` = Your Supabase project URL
- [ ] `REACT_APP_SUPABASE_ANON_KEY` = Your Supabase anon/public key

## Supabase Configuration

- [ ] Add Vercel URL to Supabase Auth → URL Configuration:
  - [ ] Redirect URLs: `https://your-app.vercel.app` and `https://your-app.vercel.app/**`
  - [ ] Site URL: `https://your-app.vercel.app`
  - [ ] Add preview URL pattern: `https://your-app-*.vercel.app`

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

