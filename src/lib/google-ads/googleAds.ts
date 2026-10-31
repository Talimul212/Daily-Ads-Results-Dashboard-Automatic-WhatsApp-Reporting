import { describeGoogleAdsError, getCustomerInstance } from "./client";

export type CampaignRange =
  | "LAST_7_DAYS"
  | "LAST_14_DAYS"
  | "LAST_30_DAYS"
  | "LAST_MONTH"
  | "THIS_MONTH";

export interface CampaignReportRow {
  id: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

type CampaignReportResult =
  | {
      success: true;
      reports: CampaignReportRow[];
      totals: { impressions: number; clicks: number; cost: number; conversions: number };
    }
  | { success: false; error: string };

const STATUS_LABELS: Record<number, string> = {
  2: "ENABLED",
  3: "PAUSED",
  4: "REMOVED",
};

// Each report costs 1 API operation; reuse successful ones for 10 minutes.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; result: CampaignReportResult }>();

/**
 * Campaign-level report for one sub-account. `range` is a GAQL date-range
 * literal or explicit dates; when omitted, the last 90 days are queried
 * (GAQL has no LAST_3_MONTHS literal).
 */
export async function getCampaignReport(
  subCustomerId: string,
  range?: CampaignRange | { start: string; end: string },
): Promise<CampaignReportResult & { cachedAt?: number }> {
  const key = `${subCustomerId}:${JSON.stringify(range ?? "90D")}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { ...cached.result, cachedAt: cached.at };
  }

  const result = await queryCampaignReport(subCustomerId, range);
  if (result.success) cache.set(key, { at: Date.now(), result });
  return result;
}

async function queryCampaignReport(
  subCustomerId: string,
  range?: CampaignRange | { start: string; end: string },
): Promise<CampaignReportResult> {
  try {
    const customer = getCustomerInstance({ customerId: subCustomerId });

    const during =
      typeof range === "string"
        ? `segments.date DURING ${range}`
        : range
          ? `segments.date BETWEEN '${range.start}' AND '${range.end}'`
          : `segments.date BETWEEN '${daysAgo(90)}' AND '${daysAgo(1)}'`;

    const response = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE ${during}
      ORDER BY metrics.cost_micros DESC
    `);

    const reports: CampaignReportRow[] = response.map((row: any) => ({
      id: String(row.campaign.id),
      name: row.campaign.name,
      status: STATUS_LABELS[row.campaign.status] ?? String(row.campaign.status),
      impressions: Number(row.metrics.impressions ?? 0),
      clicks: Number(row.metrics.clicks ?? 0),
      cost: Number(row.metrics.cost_micros ?? 0) / 1_000_000,
      conversions: Number(row.metrics.conversions ?? 0),
    }));

    const totals = reports.reduce(
      (acc, curr) => {
        acc.impressions += curr.impressions;
        acc.clicks += curr.clicks;
        acc.cost += curr.cost;
        acc.conversions += curr.conversions;
        return acc;
      },
      { impressions: 0, clicks: 0, cost: 0, conversions: 0 },
    );

    return { success: true, reports, totals };
  } catch (error: any) {
    console.error("Google Ads API Error:", error?.errors ?? error);
    return { success: false, error: describeGoogleAdsError(error) };
  }
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}
