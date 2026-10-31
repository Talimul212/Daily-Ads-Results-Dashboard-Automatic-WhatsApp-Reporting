# Brief: Move the Ads Report tool into core.digitalresolution.net/tracker

> Give this file to the developer, or paste it into an AI coding assistant opened on this repo.

## Goal

Make this repo (Next.js 14 + Prisma + Postgres) run as the **Tracker** module of our
all-in-one platform:

- `https://core.digitalresolution.net/tracker/track-overview` → the daily overview of all ad accounts
- `https://core.digitalresolution.net/tracker/clients/<id>` → one account's report
- `https://core.digitalresolution.net/tracker/r/<token>` → read-only report link for a client

Do it in **three steps**. Ship each step before starting the next.

---

## What already exists (read these first)

| Area | File | Notes |
|---|---|---|
| Google Ads client | `src/lib/google-ads/client.ts` | OAuth via env vars. Patch that drops the empty `developer-token` header (tokens were sunset 9 Sep 2026). `describeGoogleAdsError()` turns API errors into plain sentences. |
| Daily data pull | `src/lib/google-ads/queries.ts` | `fetchGoogleAdsMetricsRange()`: 3 GAQL queries per account, for **any** date range |
| Sync job | `src/lib/services/sync-service.ts` | 5 accounts at a time, saves to `daily_metrics` |
| Cron | `src/app/api/cron/daily-report/route.ts` + `vercel.json` | 08:00 SGT: pull yesterday, then send WhatsApp reports |
| Auth | `src/middleware.ts`, `src/lib/auth/*` | Signed cookie, roles `ADMIN` / `SPECIALIST`. **All permission checks go through `getCurrentUser()` and `canAccessClient()`.** |
| Pages | `src/app/(app)/…`, `src/app/(public)/…` | Overview, account page, settings, login, client link |
| Charts | `src/components/BarChart.tsx`, `AccountReport.tsx`, `DateRangePicker.tsx` | No chart library yet |
| Health check | `npm run diagnose:ads` | Lists the accounts the credentials can reach |

Quota today: Explorer access = **2,880 operations/day**. One GAQL query = 1 operation.
50 accounts × 3 queries = ~150/day.

---

## Step 1: Mount under `/tracker` on the main domain

1. In `next.config.mjs` add `basePath: "/tracker"`. Then fix every hard-coded path: `fetch("/api/…")`, `<img src="/api/…">`, `window.location.href`, redirects in `middleware.ts` and `(app)/layout.tsx`, and the share-link URL in `src/app/api/client/[id]/share/route.ts`.
   Use one helper (e.g. `withBase(path)`) instead of editing strings one by one.
2. Add a route `track-overview` that renders the current overview (`src/app/(app)/page.tsx`). Keep `/` redirecting to it.
3. Deploy this app on its own (Vercel project or container). Then, in the platform's reverse proxy (Nginx, Cloudflare or Vercel rewrites), forward `core.digitalresolution.net/tracker/*` to it.
4. Update `NEXT_PUBLIC_APP_URL=https://core.digitalresolution.net/tracker`. WhatsApp image URLs and client links are built from it.
5. Change the Vercel cron path to `/tracker/api/cron/daily-report`.

**Done when:** every page and API works under `/tracker`, the report-card image loads from the public URL, and the cron returns 200 with the secret.

## Step 2: Use the platform's login (one sign-in for everything)

The platform already has users, so don't keep a second login.

1. Find how the core platform proves who is logged in: a shared cookie on `.digitalresolution.net`, a JWT, or an internal `/me` endpoint. **Ask the platform owner; don't guess.**
2. Replace the body of `getCurrentUser()` in `src/lib/auth/server.ts`, and the token check in `src/middleware.ts`, with that check. Map platform users to the `users` table by email, and keep `role` (`ADMIN` / `SPECIALIST`) in our table.
3. Keep `canAccessClient()` and the scoping in every API route **unchanged**. That is where "a specialist sees only their own accounts" is enforced.
4. Remove `/login` and the `user:password` script once platform login works. Keep the `/r/<token>` client links public.

**Done when:** a platform user lands in Tracker already signed in, specialists see only their clients, and an admin sees all of them.

## Step 3: Secure, fast data pulls and a more visual overview

### 3a. Security (do all of these)

- [ ] **Read-only Google user.** Create the refresh token from a dedicated Google account that has **Read-only** access on the MCC, not a personal admin login. Store it only in the host's secret store, never in a `NEXT_PUBLIC_*` variable or in git.
- [ ] **Fail closed on cron.** The cron route currently skips the check when `CRON_SECRET` is unset. Make it return 401 instead.
- [ ] **Validate before building GAQL.** Customer IDs must be exactly 10 digits and dates must match `YYYY-MM-DD`. Put this in one function and use it in `queries.ts`, `googleAds.ts` and the import route. Never put raw user input into a query string.
- [ ] **Rate-limit** `/api/auth/*` (only if the local login is kept), `/api/portal/*` and `/api/sync` per IP or user, using Upstash or the platform's limiter.
- [ ] **Check `Origin`** on POST, PUT and DELETE requests to stop cross-site requests.
- [ ] **Client links:** add an optional expiry date and log every view in `audit_logs`.
- [ ] **Security headers** (CSP, `X-Frame-Options`, HSTS) in `next.config.mjs` or at the proxy.
- [ ] **Encrypt at rest.** If we ever store per-client refresh tokens, encrypt them with AES-GCM using a key held in the secret store.

### 3b. Faster, cheaper, more correct data pulls

- [ ] **Re-pull the last 7 days every night, not only yesterday.** Google keeps crediting conversions to the click date for days afterwards, so "yesterday" changes. `fetchGoogleAdsMetricsRange()` already costs the same 3 operations for 7 days as for 1.
- [ ] **Store campaign rows.** Add a `campaign_daily_metrics` table (client, date, campaign_id, name, status, clicks, impressions, cost, conversions) filled by the same nightly run. The account page and client links then read from the database and never call Google live.
- [ ] **Job queue instead of one long request.** The cron enqueues one job per account (QStash, Inngest, or a `sync_jobs` table). Each job retries with backoff on `RESOURCE_EXHAUSTED` or `INTERNAL_ERROR`, and is idempotent per (client, date). That way 50 or 500 accounts never hit the serverless time limit.
- [ ] **Count operations.** Log how many operations each run uses and show today's total on the admin page. Warn above 70% of the daily limit, and apply for Basic access (15,000/day) before reaching it.
- [ ] **Library upgrade.** When `google-ads-api` stops sending an empty `developer-token` header, upgrade it and delete the patch in `client.ts`. Run `npm run diagnose:ads` afterwards.

### 3c. A more visual track-overview page

Build these on the existing data. Add a chart library (e.g. Recharts) and keep the current colours: indigo for single series, indigo + teal for Call vs WhatsApp. No dual-axis charts.

1. **Headline tiles:** conversions, spend, CPA and CTR for the chosen range, each with % change vs the previous period and a small sparkline.
2. **Account leaderboard:** sortable table of all accounts (or the specialist's own) with conversions, spend, CPA, a 30-day mini trend and a status badge (`On target` / `High CPA` / `No conversions` / `Data missing`). Badges show an icon and text, not colour only.
3. **Spend vs conversions over time:** two small charts stacked, sharing the date axis.
4. **When leads come in:** heatmap of hour × weekday from `hourlyMetrics`, to help schedule ads and staff.
5. **Lead mix:** Call vs WhatsApp vs Other, and conversions by service label.
6. **Alerts panel:** accounts that spent with 0 conversions, CPA over threshold, failed syncs, unsent WhatsApp reports. Each links to the account page.
7. Use the same `DateRangePicker` (7D / 30D / 90D / Custom) at the top. Every chart has a hover tooltip and a table view for accessibility.

**Done when:** an admin can tell in 10 seconds which accounts need attention today, without opening any of them.

---

## Rules while working

- Don't run `prisma migrate dev` or use the live database as a shadow database. Write migration SQL by hand and apply it with `prisma migrate deploy`.
- Keep every API route scoped: specialists get only their clients, client links get only their own client.
- Don't put secrets in code, logs or screenshots.
- After each step, run `npx tsc --noEmit` and `npm run diagnose:ads`, then click through the overview, an account page and a client link.
