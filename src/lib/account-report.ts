import prisma from "./prisma";

/**
 * Everything the account report page needs for one client and date range,
 * read from the database only (no Google Ads API operations).
 * `forClient` drops internal details (WhatsApp IDs, phone numbers, send logs)
 * for the client-facing share link.
 */
export async function loadAccountReport(
  where: { id: string } | { shareToken: string },
  startDate: string,
  endDate: string,
  forClient = false
) {
  const client = await prisma.client.findFirst({
    where,
    include: {
      googleAdsAccounts: true,
      whatsappGroup: true,
      dailyMetrics: {
        where: { date: { gte: startDate, lte: endDate } },
        orderBy: { date: "asc" },
      },
      reportLogs: {
        where: { date: { gte: startDate, lte: endDate } },
        orderBy: { date: "desc" },
      },
    },
  });
  if (!client) return null;

  return {
    startDate,
    endDate,
    client: {
      id: client.id,
      name: client.name,
      specialistName: client.specialistName,
      currency: client.currency,
      highCpaThreshold: forClient ? null : client.highCpaThreshold,
      customerId: client.googleAdsAccounts[0]?.customerId ?? null,
      shareEnabled: Boolean(client.shareToken),
      whatsappLinked: Boolean(client.whatsappGroup?.groupId),
      reportLogs: forClient
        ? []
        : client.reportLogs.map((r) => ({ date: r.date, status: r.status, error: r.error, sentAt: r.sentAt })),
      dailyMetrics: client.dailyMetrics.map((m) => ({
        date: m.date,
        clicks: m.clicks,
        impressions: m.impressions,
        ctr: m.ctr,
        avgCpc: m.avgCpc,
        cost: m.cost,
        conversions: m.conversions,
        callConversions: m.callConversions,
        whatsappConversions: m.whatsappConversions,
        perService: JSON.parse(m.perService || "{}"),
        hourlyMetrics: JSON.parse(m.hourlyMetrics || "[]"),
      })),
    },
  };
}

export type AccountReportData = NonNullable<Awaited<ReturnType<typeof loadAccountReport>>>;
