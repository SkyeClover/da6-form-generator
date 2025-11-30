# OAuth Redirect Fix

If you're being redirected back to the login screen after signing in with Google, check these:

## 1. Verify Supabase Redirect URLs

Go to: https://supabase.com/dashboard/project/emutqazwbtikbvvopxpl/auth/url-configuration

Make sure:
- **Site URL**: `http://localhost:3000`
- **Redirect URLs** includes: `http://localhost:3000/**` (with the `/**` wildcard)

Click **Save** if you made changes.

## 2. Check Browser Console

Open your browser's developer console (F12) and look for:
- Any error messages
- Check the Network tab for failed requests
- Look for messages about "Auth state changed"

## 3. Clear Browser Storage

Sometimes old session data can cause issues:

1. Open Developer Tools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Clear:
   - Local Storage
   - Session Storage
   - Cookies (for localhost:3000)
4. Refresh the page and try again

## 4. Check the URL After Redirect

After signing in with Google, check the URL in your browser. It should look like:
```
http://localhost:3000/dashboard#access_token=...&refresh_token=...
```

If you see hash fragments (`#access_token=...`), Supabase is trying to pass the session. The app should detect this automatically.

## 5. Test the Fix

I've updated the code to:
- Better handle OAuth callbacks
- Redirect to `/dashboard` after login
- Add logging to help debug

**Try signing in again** and check the browser console for "Auth state changed" messages.

## Still Not Working?

If it's still not working, check:

1. **Supabase Dashboard** → **Authentication** → **Users**
   - Do you see your user account there after signing in?
   - If yes, the OAuth is working but the session isn't being detected
   - If no, the OAuth redirect isn't completing

2. **Browser Console Errors**
   - Share any error messages you see

3. **Network Tab**
   - Check if there are any failed requests to Supabase

