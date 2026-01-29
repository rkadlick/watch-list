# 🚀 Deployment Guide - Watch List

This guide walks you through deploying the Watch List app to production.

## Prerequisites

Before deploying, ensure you have:

1. ✅ A [Vercel account](https://vercel.com/signup)
2. ✅ A [Convex account](https://www.convex.dev/) with a production deployment
3. ✅ A [Clerk account](https://clerk.com/) with your app configured
4. ✅ A [TMDB API key](https://www.themoviedb.org/settings/api)

---

## Step 1: Deploy Convex Backend

First, deploy your Convex functions to production:

```bash
# Login to Convex (if not already)
npx convex login

# Deploy to production
npx convex deploy --prod
```

After deployment, Convex will provide you with:
- **Production Convex URL**: `https://your-project.convex.cloud`
- **Deployment name**: `your-deployment-name`

Save these values - you'll need them for Vercel.

---

## Step 2: Configure Clerk for Production

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com/)
2. Navigate to **API Keys**
3. Copy the following values:
   - `CLERK_PUBLISHABLE_KEY` (starts with `pk_live_...` or `pk_test_...`)
   - `CLERK_JWT_ISSUER_DOMAIN` (e.g., `your-app.clerk.accounts.dev`)

4. **Important**: Add your production domain to Clerk's allowed origins:
   - Go to **Domains** in Clerk dashboard
   - Add your Vercel domain (e.g., `your-app.vercel.app`)

---

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### Option B: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/new)
2. Import your Git repository
3. Vercel will auto-detect Next.js settings
4. Click **Deploy**

---

## Step 4: Set Environment Variables in Vercel

After creating your Vercel project, add these environment variables:

### Via Vercel Dashboard:
1. Go to your project → **Settings** → **Environment Variables**
2. Add the following variables:

| Variable Name | Value | Where to Get It |
|--------------|-------|-----------------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://your-project.convex.cloud` | Convex Dashboard → Settings |
| `CONVEX_DEPLOYMENT` | `prod:your-deployment-name` | Convex Dashboard → Settings |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk Dashboard → API Keys |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Same as above |
| `CLERK_JWT_ISSUER_DOMAIN` | `your-app.clerk.accounts.dev` | Clerk Dashboard → API Keys |
| `TMDB_API_KEY` | `your-tmdb-api-key` | TMDB Settings → API |

### Via Vercel CLI:

```bash
# Set each environment variable
vercel env add NEXT_PUBLIC_CONVEX_URL production
vercel env add CONVEX_DEPLOYMENT production
vercel env add CLERK_PUBLISHABLE_KEY production
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_JWT_ISSUER_DOMAIN production
vercel env add TMDB_API_KEY production
```

**Note**: Make sure to set these for **Production** environment.

---

## Step 5: Redeploy with Environment Variables

After adding environment variables, trigger a new deployment:

```bash
# Via CLI
vercel --prod

# Or via Dashboard
# Go to Deployments → Click "Redeploy" on latest deployment
```

---

## Step 6: Configure Custom Domain (Optional)

1. Go to your Vercel project → **Settings** → **Domains**
2. Add your custom domain (e.g., `watchlist.yourdomain.com`)
3. Follow Vercel's DNS configuration instructions
4. **Important**: Add the custom domain to Clerk's allowed origins

---

## Step 7: Verify Deployment

After deployment completes, verify everything works:

### ✅ Checklist:
- [ ] Visit your production URL
- [ ] Sign in with Clerk authentication
- [ ] Create a new list
- [ ] Search for a movie/TV show (tests TMDB API)
- [ ] Add media to your list
- [ ] Verify data persists (tests Convex)
- [ ] Test on mobile device
- [ ] Check browser console for errors

---

## Troubleshooting

### Issue: "Missing environment variables" error

**Solution**: 
1. Verify all env vars are set in Vercel dashboard
2. Make sure they're set for **Production** environment
3. Redeploy after adding variables

### Issue: Authentication fails

**Solution**:
1. Check that your production domain is added to Clerk's allowed origins
2. Verify `CLERK_JWT_ISSUER_DOMAIN` matches your Clerk dashboard
3. Ensure `CLERK_PUBLISHABLE_KEY` is the correct one (live vs test)

### Issue: TMDB search doesn't work

**Solution**:
1. Verify `TMDB_API_KEY` is set correctly
2. Check TMDB API quota hasn't been exceeded
3. Test the API key directly: `curl "https://api.themoviedb.org/3/search/multi?api_key=YOUR_KEY&query=test"`

### Issue: Convex queries fail

**Solution**:
1. Ensure Convex production deployment is active
2. Verify `NEXT_PUBLIC_CONVEX_URL` matches your Convex dashboard
3. Check Convex logs for errors: `npx convex logs --prod`

---

## Monitoring & Maintenance

### View Logs

```bash
# Vercel logs
vercel logs --prod

# Convex logs
npx convex logs --prod
```

### Rollback Deployment

If something goes wrong:

```bash
# Via CLI - redeploy a previous version
vercel rollback

# Or via Dashboard
# Go to Deployments → Find working deployment → Click "Promote to Production"
```

---

## Environment Variables Reference

Quick copy-paste template for your `.env.local` (for local development):

```bash
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOYMENT=prod:your-deployment-name

# Clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_JWT_ISSUER_DOMAIN=your-app.clerk.accounts.dev

# TMDB
TMDB_API_KEY=your-tmdb-api-key
```

---

## Post-Deployment Tasks

After successful deployment:

1. ✅ Set up error monitoring (see MONITORING.md - coming soon)
2. ✅ Configure analytics (optional)
3. ✅ Set up uptime monitoring (e.g., UptimeRobot)
4. ✅ Share the app with your users!

---

## Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **Convex Docs**: https://docs.convex.dev
- **Clerk Docs**: https://clerk.com/docs
- **Next.js Docs**: https://nextjs.org/docs

---

**Last Updated**: January 29, 2026
