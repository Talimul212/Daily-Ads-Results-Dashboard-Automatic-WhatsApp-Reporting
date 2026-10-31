import prisma from "../prisma";
import {
  fetchGoogleAdsMetricsRange,
  generateMockDailyMetrics,
  getYesterdayDateInTimezone,
} from "../google-ads/queries";
import { ClientSyncConfig, GoogleAdsDailyResult } from "../google-ads/types";

export interface SyncResultItem {
  clientId: string;
  clientName: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  metrics?: GoogleAdsDailyResult;
  daysSynced?: number;
  error?: string;
}

export interface DailySyncSummary {
  date: string;
  startDate: string;
  totalClients: number;
  succeeded: number;
  failed: number;
  items: SyncResultItem[];
}

// Accounts synced in parallel. Each account costs 3 API operations per run
// (whatever the date range), so 50 accounts ≈ 150 operations.
const CONCURRENCY = 5;

/**
 * Sync daily metrics for one or all clients, for a single date or a date range.
 * Robust design: An error in one client never halts processing of other clients.
 */
export async function syncDailyGoogleAdsMetrics(options?: {
  clientId?: string;
  /** Limit to clients assigned to this specialist. */
  specialistId?: string;
  date?: string;
  /** With `date` as the end date, backfills every day from startDate. */
  startDate?: string;
  useMockIfUnconfigured?: boolean;
}): Promise<DailySyncSummary> {
  const targetDate = options?.date || getYesterdayDateInTimezone();
  const startDate = options?.startDate && options.startDate < targetDate ? options.startDate : targetDate;
  const useMockIfUnconfigured = options?.useMockIfUnconfigured ?? true;

  // 1. Fetch target clients
  const clientWhere: any = { active: true };
  if (options?.clientId) {
    clientWhere.id = options.clientId;
  }
  if (options?.specialistId) {
    clientWhere.specialistId = options.specialistId;
  }

  const clients = await prisma.client.findMany({
    where: clientWhere,
    include: {
      googleAdsAccounts: true,
      campaignServiceMaps: true,
      conversionActionMaps: true,
    },
  });

  const isGoogleAdsConfigured = Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN
  );

  const syncClient = async (client: (typeof clients)[number]): Promise<SyncResultItem> => {
    const activeAccount = client.googleAdsAccounts.find((acc) => acc.status === "ACTIVE");

    if (!activeAccount) {
      return {
        clientId: client.id,
        clientName: client.name,
        status: "SKIPPED",
        error: "No active Google Ads account linked to this client",
      };
    }

    const config: ClientSyncConfig = {
      id: client.id,
      name: client.name,
      customerId: activeAccount.customerId,
      loginCustomerId: activeAccount.loginCustomerId,
      currency: client.currency,
      timezone: client.timezone,
      campaignServiceMaps: client.campaignServiceMaps.map((c) => ({
        campaignNamePattern: c.campaignNamePattern,
        serviceLabel: c.serviceLabel,
      })),
      conversionActionMaps: client.conversionActionMaps.map((c) => ({
        conversionActionName: c.conversionActionName,
        type: c.type as "CALL" | "WHATSAPP" | "OTHER",
      })),
    };

    try {
      let byDate: Map<string, GoogleAdsDailyResult>;

      if (isGoogleAdsConfigured) {
        // Query live Google Ads API
        byDate = await fetchGoogleAdsMetricsRange(config, startDate, targetDate);
      } else if (useMockIfUnconfigured) {
        // Fallback to realistic deterministic mock data for testing/demo
        byDate = new Map([[targetDate, generateMockDailyMetrics(config, targetDate)]]);
      } else {
        throw new Error("Google Ads credentials not configured in environment variables.");
      }

      for (const [date, metrics] of Array.from(byDate)) {
        await saveDailyMetrics(client.id, date, metrics, date === targetDate);
      }

      return {
        clientId: client.id,
        clientName: client.name,
        status: "SUCCESS",
        metrics: byDate.get(targetDate),
        daysSynced: byDate.size,
      };
    } catch (err: any) {
      const errorMessage = err?.message || String(err);

      // Record failure in report_logs
      await prisma.reportLog.upsert({
        where: {
          clientId_date: {
            clientId: client.id,
            date: targetDate,
          },
        },
        create: {
          clientId: client.id,
          date: targetDate,
          status: "FAILED",
          error: errorMessage,
        },
        update: {
          status: "FAILED",
          error: errorMessage,
        },
      });

      return {
        clientId: client.id,
        clientName: client.name,
        status: "FAILED",
        error: errorMessage,
      };
    }
  };

  const results: SyncResultItem[] = [];
  for (let i = 0; i < clients.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(clients.slice(i, i + CONCURRENCY).map(syncClient))));
  }

  return {
    date: targetDate,
    startDate,
    totalClients: clients.length,
    succeeded: results.filter((r) => r.status === "SUCCESS").length,
    failed: results.filter((r) => r.status === "FAILED").length,
    items: results,
  };
}

async function saveDailyMetrics(
  clientId: string,
  date: string,
  metrics: GoogleAdsDailyResult,
  isReportDay: boolean
) {
  const values = {
    clicks: metrics.clicks,
    impressions: metrics.impressions,
    ctr: metrics.ctr,
    avgCpc: metrics.avgCpc,
    cost: metrics.cost,
    conversions: metrics.conversions,
    callConversions: metrics.callConversions,
    whatsappConversions: metrics.whatsappConversions,
    perService: JSON.stringify(metrics.perService),
    hourlyMetrics: JSON.stringify(metrics.hourlyMetrics),
  };

  await prisma.dailyMetric.upsert({
    where: { clientId_date: { clientId, date } },
    create: { clientId, date, ...values },
    update: values,
  });

  // Ensure the report day has a report_logs entry; keep its status (e.g. SENT).
  // Backfilled history days don't get one, so they never queue WhatsApp sends.
  if (!isReportDay) return;
  await prisma.reportLog.upsert({
    where: { clientId_date: { clientId, date } },
    create: { clientId, date, status: "PENDING" },
    update: {},
  });
}
