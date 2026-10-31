import { describeGoogleAdsError, getCustomerInstance } from "./client";
import {
  ClientSyncConfig,
  GoogleAdsDailyResult,
  HourlyMetricPoint,
  ServiceConversionSummary,
} from "./types";

/**
 * Returns yesterday's date string (YYYY-MM-DD) in the specified timezone (default 'Asia/Singapore')
 */
export function getYesterdayDateInTimezone(timezone: string = "Asia/Singapore"): string {
  const now = new Date();
  // Adjust to timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // Subtract 1 day
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return formatter.format(yesterday); // Formats as YYYY-MM-DD
}

/**
 * Fetch daily metrics for a specific client account for a specific date (YYYY-MM-DD).
 * Costs 3 API operations.
 */
export async function fetchGoogleAdsDailyMetrics(
  config: ClientSyncConfig,
  targetDate: string
): Promise<GoogleAdsDailyResult> {
  const byDate = await fetchGoogleAdsMetricsRange(config, targetDate, targetDate);
  return byDate.get(targetDate) ?? buildDailyResult(config, targetDate, [], [], []);
}

/**
 * Fetch per-day metrics for every date in [startDate, endDate] (inclusive).
 * Each GAQL query counts as one operation however many rows it returns, so a
 * 90-day backfill costs the same 3 operations per account as a single day.
 * Dates with no activity are returned as zero-filled results.
 */
export async function fetchGoogleAdsMetricsRange(
  config: ClientSyncConfig,
  startDate: string,
  endDate: string
): Promise<Map<string, GoogleAdsDailyResult>> {
  const warnings: string[] = [];

  try {
    const customer = getCustomerInstance({
      customerId: config.customerId,
      loginCustomerId: config.loginCustomerId,
    });
    const during = `segments.date BETWEEN '${startDate}' AND '${endDate}'`;

    // 1. Hourly metrics per day (also the source of daily totals)
    const hourlyQuery = `
      SELECT
        segments.date,
        segments.hour,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.conversions
      FROM customer
      WHERE ${during}
    `;

    // 2. Campaign data for Service Label mapping
    const campaignQuery = `
      SELECT
        segments.date,
        campaign.id,
        campaign.name,
        metrics.conversions
      FROM campaign
      WHERE ${during} AND metrics.conversions > 0
    `;

    // 3. Conversion Actions for Call / WhatsApp split
    const conversionQuery = `
      SELECT
        segments.date,
        segments.conversion_action_name,
        metrics.conversions
      FROM customer
      WHERE ${during}
    `;

    const [hourlyRows, campaignRows, conversionRows] = await Promise.all([
      customer.query(hourlyQuery).catch((err: any) => {
        warnings.push(`Hourly query warning: ${describeGoogleAdsError(err)}`);
        return null;
      }),
      customer.query(campaignQuery).catch((err: any) => {
        warnings.push(`Campaign query warning: ${describeGoogleAdsError(err)}`);
        return [];
      }),
      customer.query(conversionQuery).catch((err: any) => {
        warnings.push(`Conversion query warning: ${describeGoogleAdsError(err)}`);
        return [];
      }),
    ]);

    // Totals come from the hourly query; without it we'd store zeros as "success".
    if (!hourlyRows) throw new Error(warnings[0].replace("Hourly query warning: ", ""));

    const results = new Map<string, GoogleAdsDailyResult>();
    for (const date of datesBetween(startDate, endDate)) {
      const pick = (rows: any[]) => rows.filter((r) => r.segments?.date === date);
      const result = buildDailyResult(
        config,
        date,
        pick(hourlyRows as any[]),
        pick(campaignRows as any[]),
        pick(conversionRows as any[])
      );
      if (warnings.length > 0) result.rawWarnings = warnings;
      results.set(date, result);
    }
    return results;
  } catch (err: any) {
    throw new Error(
      `Failed to pull Google Ads data for ${config.name} (${config.customerId}): ${err.message}`
    );
  }
}

function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function buildDailyResult(
  config: ClientSyncConfig,
  targetDate: string,
  hourlyRows: any[],
  campaignRows: any[],
  conversionRows: any[]
): GoogleAdsDailyResult {
  // Build 24-hour map
  const hourlyMap: { [hour: number]: HourlyMetricPoint } = {};
  for (let h = 0; h < 24; h++) {
    hourlyMap[h] = {
      hour: h,
      clicks: 0,
      impressions: 0,
      cost: 0,
      conversions: 0,
    };
  }

  let totalClicks = 0;
  let totalImpressions = 0;
  let totalCostMicros = 0;
  let totalConversions = 0;

  for (const row of hourlyRows) {
    const h = Number(row.segments?.hour ?? 0);
    const c = Number(row.metrics?.clicks ?? 0);
    const imp = Number(row.metrics?.impressions ?? 0);
    const costMicros = Number(row.metrics?.cost_micros ?? 0);
    const conv = Number(row.metrics?.conversions ?? 0);
    const costUnits = costMicros / 1000000;

    if (hourlyMap[h]) {
      hourlyMap[h].clicks += c;
      hourlyMap[h].impressions += imp;
      hourlyMap[h].cost = Number((hourlyMap[h].cost + costUnits).toFixed(2));
      hourlyMap[h].conversions = Number((hourlyMap[h].conversions + conv).toFixed(2));
    }

    totalClicks += c;
    totalImpressions += imp;
    totalCostMicros += costMicros;
    totalConversions += conv;
  }

  // Process Campaign Service Map
  const perService: ServiceConversionSummary = {};
  for (const row of campaignRows) {
    const campaignName = String(row.campaign?.name || "");
    const conv = Number(row.metrics?.conversions || 0);

    if (conv > 0) {
      let matched = false;
      for (const map of config.campaignServiceMaps) {
        const regex = new RegExp(map.campaignNamePattern, "i");
        if (regex.test(campaignName)) {
          perService[map.serviceLabel] = Number(
            ((perService[map.serviceLabel] || 0) + conv).toFixed(2)
          );
          matched = true;
          break;
        }
      }
      if (!matched) {
        // If no specific service map pattern matched, label as Other or campaign name
        perService["Other"] = Number(((perService["Other"] || 0) + conv).toFixed(2));
      }
    }
  }

  // Process Conversion Action Map (Call vs WhatsApp vs Other)
  let callConversions = 0;
  let whatsappConversions = 0;
  let otherConversions = 0;

  for (const row of conversionRows) {
    const actionName = String(row.segments?.conversion_action_name || "").toLowerCase();
    const conv = Number(row.metrics?.conversions || 0);

    // Check client-configured conversion maps first
    const matchedMap = config.conversionActionMaps.find(
      (m) => m.conversionActionName.toLowerCase() === actionName
    );

    if (matchedMap) {
      if (matchedMap.type === "CALL") callConversions += conv;
      else if (matchedMap.type === "WHATSAPP") whatsappConversions += conv;
      else otherConversions += conv;
    } else {
      // Fallback heuristic: check if action name contains 'call' or 'whatsapp'
      if (actionName.includes("call") || actionName.includes("phone")) {
        callConversions += conv;
      } else if (actionName.includes("whatsapp") || actionName.includes("wa")) {
        whatsappConversions += conv;
      } else {
        otherConversions += conv;
      }
    }
  }

  const totalCost = Number((totalCostMicros / 1000000).toFixed(2));
  const ctr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
  const avgCpc = totalClicks > 0 ? Number((totalCost / totalClicks).toFixed(2)) : 0;

  return {
    date: targetDate,
    clicks: totalClicks,
    impressions: totalImpressions,
    ctr,
    avgCpc,
    cost: totalCost,
    conversions: Number(totalConversions.toFixed(2)),
    callConversions: Number(callConversions.toFixed(2)),
    whatsappConversions: Number(whatsappConversions.toFixed(2)),
    otherConversions: Number(otherConversions.toFixed(2)),
    perService,
    hourlyMetrics: Object.values(hourlyMap),
    hasData: totalImpressions > 0 || totalClicks > 0 || totalCost > 0,
  };
}

/**
 * Generate simulated realistic data for development and testing.
 * Perfect for verifying calculations and report layout without needing live API tokens.
 */
export function generateMockDailyMetrics(
  config: ClientSyncConfig,
  targetDate: string
): GoogleAdsDailyResult {
  const seed = config.name.length + targetDate.length;
  const clicks = 8 + (seed % 15);
  const impressions = clicks * 14 + 25;
  const ctr = Number(((clicks / impressions) * 100).toFixed(2));
  const avgCpc = Number((3.5 + (seed % 4) * 0.45).toFixed(2));
  const cost = Number((clicks * avgCpc).toFixed(2));

  // Conversions
  const totalConversions = Math.max(1, Math.floor(clicks * 0.35));
  const callConversions = Math.floor(totalConversions * 0.4);
  const whatsappConversions = totalConversions - callConversions;

  // Hourly metrics simulation with multi-peak spikes matching Google Ads patterns
  const hourlyMetrics: HourlyMetricPoint[] = [];
  // Spikes pattern multiplier for 24 hours: peak morning (9-11), lunch (12-14), afternoon (16-18), evening (20-22)
  const spikePattern = [
    0.1, 0.05, 0.0, 0.0, 0.05, 0.1, 0.3, 0.6, 1.2, 2.4, 1.8, 2.1, 2.5, 1.9, 1.4, 1.7, 2.3, 2.0, 1.5, 1.8, 2.2, 1.6, 0.8, 0.3
  ];
  
  const totalWeight = spikePattern.reduce((a, b) => a + b, 0);

  let allocatedClicks = 0;
  let allocatedConversions = 0;

  for (let h = 0; h < 24; h++) {
    const weight = spikePattern[h];
    // Calculate clicks with spikes
    const hClicks = Math.round((clicks * weight) / totalWeight);
    allocatedClicks += hClicks;

    const hImp = hClicks > 0 ? hClicks * (12 + (h % 5)) : (weight > 0.5 ? Math.round(weight * 10) : 0);
    const hCost = Number((hClicks * avgCpc).toFixed(2));
    
    // Conversions spike during key hours (e.g. 9 AM, 12 PM, 4 PM, 8 PM)
    const isConvHour = (h === 9 || h === 12 || h === 16 || h === 20 || h === 21) && totalConversions > allocatedConversions;
    const hConversions = isConvHour ? Math.min(2, totalConversions - allocatedConversions) : 0;
    allocatedConversions += hConversions;

    hourlyMetrics.push({
      hour: h,
      clicks: hClicks,
      impressions: hImp,
      cost: hCost,
      conversions: hConversions,
    });
  }

  // Ensure total sum consistency
  const actualClicksSum = hourlyMetrics.reduce((s, h) => s + h.clicks, 0);
  if (actualClicksSum < clicks && hourlyMetrics[12]) {
    hourlyMetrics[12].clicks += (clicks - actualClicksSum);
    hourlyMetrics[12].cost = Number((hourlyMetrics[12].clicks * avgCpc).toFixed(2));
  }
  const actualConvSum = hourlyMetrics.reduce((s, h) => s + h.conversions, 0);
  if (actualConvSum < totalConversions && hourlyMetrics[16]) {
    hourlyMetrics[16].conversions += (totalConversions - actualConvSum);
  }

  // Service breakdown
  const perService: ServiceConversionSummary = {};
  if (config.campaignServiceMaps.length > 0) {
    let remaining = totalConversions;
    config.campaignServiceMaps.forEach((map, index) => {
      if (remaining > 0) {
        const count = index === config.campaignServiceMaps.length - 1 ? remaining : Math.ceil(remaining / 2);
        perService[map.serviceLabel] = count;
        remaining -= count;
      }
    });
  } else {
    perService["General"] = totalConversions;
  }

  return {
    date: targetDate,
    clicks,
    impressions,
    ctr,
    avgCpc,
    cost,
    conversions: totalConversions,
    callConversions,
    whatsappConversions,
    otherConversions: 0,
    perService,
    hourlyMetrics,
    hasData: true,
  };
}
