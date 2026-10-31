# Daily Ads Results Dashboard + Automatic WhatsApp Reporting

Internal automation & reporting tool built for **Digital Resolution (Singapore)** to manage Google Ads performance and automated WhatsApp group reporting for 50+ local service businesses (handyman, plumbing, carpentry, auto care, drilling, etc.).

---

## 🚀 Quick Start (Local Testing)

The project is fully initialized and pre-seeded with 5 sample Singapore local service clients.

### 1. Start the Dashboard
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Daily Overview Dashboard**: View all clients, top KPIs (Total Conversions, Ad Spend SGD, Needs Attention), sort by any column, filter by problem status.
- **Client Slide-out Drawer**: Click any company row to see the live Google Ads Report Card image preview, formatted WhatsApp caption, 1-click copy, and "Dispatch to WhatsApp" button.
- **Client & Account Settings**: Go to [http://localhost:3000/settings](http://localhost:3000/settings) to add new clients, configure Google Ads Customer IDs (CIDs), campaign-to-service rules, and WhatsApp group IDs in under a minute without touching code.

---

## 🧪 Terminal Test Scripts

You can also run verification tests directly from the command line:

### 1. Test Google Ads Data Extraction & GAQL Query Engine
```bash
npm run test:ads
```
Tests timezone date calculation (`Asia/Singapore`), hourly data segmentation (24-hour bins), campaign-to-service label mapping (e.g. `HMS` -> `HM`), conversion action categorization (`Call` vs `WhatsApp`), and prints the formatted WhatsApp caption.

### 2. Test Automated Cron & Daily WhatsApp Dispatch
```bash
npx tsx scripts/test-cron.ts
```
Executes the automated morning job:
1. Pulls yesterday's Google Ads metrics for all active clients.
2. Formats caption and generates report card images.
3. Automatically dispatches reports to WhatsApp groups (or puts clients with `requiresApproval = true` into staged review mode).
4. Verifies **idempotency** (running a second time skips already-sent reports without duplicate sends).

---

## ⚙️ Production Configuration (`.env`)

To switch from simulated verification mode to live Google Ads & Meta WhatsApp APIs, fill in the credentials in `.env`:

```env
# Database (SQLite by default; change to postgresql for Supabase)
DATABASE_URL="file:./dev.db"

# Google Ads API Credentials (from Google Cloud & MCC API Center)
GOOGLE_ADS_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_ADS_CLIENT_SECRET="your-client-secret"
GOOGLE_ADS_REFRESH_TOKEN="your-oauth2-refresh-token"
GOOGLE_ADS_DEVELOPER_TOKEN="your-developer-token"
GOOGLE_ADS_LOGIN_CUSTOMER_ID="9912345678"  # Optional Root MCC ID

# Meta WhatsApp Cloud API (from Meta Business Manager)
WHATSAPP_API_TOKEN="EAAG..."
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
WHATSAPP_BUSINESS_ACCOUNT_ID="your-waba-id"
WHATSAPP_API_VERSION="v21.0"

# Automation & Security
CRON_SECRET="your-secure-cron-secret-token"
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"
```

---

## 🛠 Architecture & Features

### 1. Data Model (Prisma)
- `clients`: Company profile, assigned specialist, Singapore timezone, currency (SGD), high CPA threshold, manual approval flag.
- `google_ads_accounts`: Customer ID (CID), MCC `login_customer_id`, status.
- `campaign_service_map`: Regex pattern matching (e.g. `HMS|Handyman` -> `HM`).
- `conversion_action_map`: Action classification (`CALL`, `WHATSAPP`, `OTHER`).
- `daily_metrics`: Daily clicks, impressions, CTR, Avg CPC, SGD cost, conversions, call/WhatsApp split, per-service JSON, 24-hour hourly JSON.
- `whatsapp_groups`: Group JID, invite link, 1-to-1 fallback phone number.
- `report_logs`: Status (`PENDING`, `SENT`, `FAILED`), image URL, sent timestamp, retry count, error tracking.

### 2. Report Card Image Generator
- Replicates the official Google Ads Overview card with 4 colored KPI boxes:
  - **Clicks**: Blue `#4285f4`
  - **Conversions**: Red `#ea4335` (with Call vs WA breakdown)
  - **CTR**: Yellow `#fbbc04` (with Avg CPC in SGD)
  - **Cost**: Green `#34a853` (with Cost per Conversion)
- 24-Hour hourly activity line graph underneath (blue line for clicks, red dotted line + badges for conversions).
- Accessible via `/api/report-card/preview/[clientId]?date=YYYY-MM-DD`.

### 3. WhatsApp Business Cloud API Integration
- Primary mode: Official Meta Cloud API Groups endpoint.
- Fallback mode: Automatic 1-to-1 fallback to client's phone number if group send fails.
- Idempotent: Never sends the same report twice for a client on the same day.
- Approval workflow: Clients flagged for review stay in `PENDING_APPROVAL` until the specialist clicks "Dispatch to WhatsApp" in the dashboard.
