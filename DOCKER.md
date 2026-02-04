# Docker Setup - Simple Guide

## Quick Start

### Step 1: Create your `.env` file

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

### Step 2: Edit `.env` file

Open `.env` and add your actual values. **You MUST set these two for the build to work:**

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... or pk_live_...
```

Also set these (they're used at runtime):

```bash
CONVEX_DEPLOYMENT=your-deployment-name
CLERK_PUBLISHABLE_KEY=pk_test_... or pk_live_...
CLERK_JWT_ISSUER_DOMAIN=your-app.clerk.accounts.dev
TMDB_API_KEY=your-tmdb-api-key
```

### Step 3: Build and run

**Option A: Using Docker Compose (Easiest)**

```bash
docker-compose up --build
```

This will:
- Read your `.env` file automatically
- Build the Docker image
- Start the container
- Make it available at http://localhost:3000

**Option B: Using Docker directly**

First, build the image:

```bash
# Source your .env file and build
export $(cat .env | grep -v '^#' | xargs)
docker build \
  --build-arg NEXT_PUBLIC_CONVEX_URL="$NEXT_PUBLIC_CONVEX_URL" \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" \
  -t watch-list:latest .
```

Then run it:

```bash
docker run -p 3000:3000 --env-file .env watch-list:latest
```

## That's it!

Your app should now be running at http://localhost:3000

## Common Commands

**Stop the container:**
```bash
docker-compose down
```

**View logs:**
```bash
docker-compose logs -f
```

**Rebuild after code changes:**
```bash
docker-compose up --build
```

## Troubleshooting

**Build fails with "Missing publishableKey":**
- Make sure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set in your `.env` file
- The value should start with `pk_test_` or `pk_live_`

**Build fails with "Invalid deployment address":**
- Make sure `NEXT_PUBLIC_CONVEX_URL` is set in your `.env` file
- It should be a full URL like `https://your-project.convex.cloud`

**Container starts but app doesn't work:**
- Check logs: `docker-compose logs`
- Make sure all environment variables in `.env` are filled in correctly
