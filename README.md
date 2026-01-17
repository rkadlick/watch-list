This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 🧩 Environment Setup

This project requires several environment variables for Convex, Clerk authentication, and TMDB integration.

Before running the app, copy the example file and fill in the required values:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and set the following values.

### **Required Variables**

| Variable | Description |
|-----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | The public Convex deployment URL, from your Convex dashboard |
| `CONVEX_DEPLOYMENT` | Your Convex project deployment ID (used by server) |
| `CLERK_PUBLISHABLE_KEY` | Your public Clerk key for the frontend SDK |
| `CLERK_JWT_ISSUER_DOMAIN` | Issuer domain for Clerk JWT validation |
| `TMDB_API_KEY` | Your API key from [The Movie Database](https://www.themoviedb.org/settings/api) |

### **Optional Variables**

| Variable | Description |
|-----------|-------------|
| `CLERK_SECRET_KEY` | Required only for server‑side auth user syncing |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Used by client‑side Clerk SDK when needed |
| `NEXT_PUBLIC_VERCEL_ANALYTICS_ID` | Only if analytics is enabled |
| `SENTRY_DSN` | Only if Sentry error monitoring is enabled |

### **Validation**

On app startup, environment validation runs automatically:

- `lib/env.ts` validates client and server variables.  
- `lib/env-check.ts` enforces required server variables at runtime.

If any required variables are missing, you’ll see a clear error in your terminal:

## ❌ Missing required environment variables:
- TMDB_API_KEY
- CLERK_JWT_ISSUER_DOMAIN

### **Getting the Keys**

**Clerk**  
- Go to [Clerk Dashboard → Applications → API Keys](https://dashboard.clerk.com/)  
- Copy your **Publishable Key** and **JWT Issuer Domain**

**Convex**  
- From your Convex project dashboard → Deployments → Copy your **Convex deployment URL**

**TMDB**  
- [Create a TMDB account / API Key](https://www.themoviedb.org/settings/api)

---

## ✅ Verify Everything

Run:

```bash
npm run dev