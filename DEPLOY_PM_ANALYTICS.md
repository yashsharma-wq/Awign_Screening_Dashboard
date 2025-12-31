# Deploying PM Analytics Page on Render

This guide explains how to deploy only the PM Analytics page on Render as a static site.

## Prerequisites

1. A Render account (free tier works)
2. Your repository connected to Render
3. Environment variables set up in Render (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY)

## Deployment Steps

### Option 1: Using Render Dashboard

1. **Go to Render Dashboard** → New → Static Site

2. **Connect your repository** (GitHub/GitLab/Bitbucket)

3. **Configure the build:**
   - **Name**: `pm-analytics` (or any name you prefer)
   - **Build Command**: `npm install && npm run build:pm-analytics`
   - **Publish Directory**: `dist-pm-analytics`
   - **Environment**: Static Site

4. **Add Environment Variables:**
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key

5. **Click "Create Static Site"**

6. **Wait for deployment** - Render will build and deploy your PM Analytics page

### Option 2: Using render.yaml (Infrastructure as Code)

1. **Create a new Static Site** in Render Dashboard

2. **Select "Infrastructure as Code"** option

3. **Point to `render-pm-analytics.yaml`** file

4. **Add Environment Variables** (same as above)

5. **Deploy**

## Build Output

The build will create a standalone version of the PM Analytics page in the `dist-pm-analytics` directory that:
- Only includes the PM Analytics page
- Has all necessary dependencies bundled
- Can be served as a static site
- No authentication required (public access)

## Testing Locally

Before deploying, test the build locally:

```bash
npm run build:pm-analytics
npm run preview:pm-analytics
```

Then visit `http://localhost:4173` to see the standalone PM Analytics page.

**Note:** Make sure to build first with `npm run build:pm-analytics` before running preview.

## Accessing the Deployed Page

Once deployed, Render will provide you with a URL like:
- `https://pm-analytics.onrender.com` (or your custom domain)

The page will be accessible to anyone via this URL without requiring login.

## Notes

- The PM Analytics page is completely standalone and doesn't require the rest of the application
- All Supabase queries will work as long as environment variables are set correctly
- The page has no navigation or routing - it's just the analytics dashboard

