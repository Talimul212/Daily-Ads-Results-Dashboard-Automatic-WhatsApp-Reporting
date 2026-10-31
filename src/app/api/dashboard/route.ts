import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getYesterdayDateInTimezone } from "@/lib/google-ads/queries";
import { getCurrentUser, isAdmin, unauthorized } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const admin = isAdmin(user);

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || getYesterdayDateInTimezone("Asia/Singapore");
    // Specialists always see only their own clients, whatever they ask for.
    const specialistFilter = admin ? searchParams.get("specialistId") : user.id;

    const clientWhere: any = { active: true };
    if (specialistFilter) {
      clientWhere.specialistId = specialistFilter;
    }

    const [clients, specialists] = await Promise.all([
      prisma.client.findMany({
        where: clientWhere,
        include: {
          googleAdsAccounts: true,
          whatsappGroup: true,
          dailyMetrics: {
            where: { date },
          },
          reportLogs: {
            where: { date },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: admin ? {} : { id: user.id },
        orderBy: { name: "asc" },
      }),
    ]);

    let totalConversions = 0;
    let totalCost = 0;
    let totalClicks = 0;
    let needsAttentionCount = 0;

    const rows = clients.map((client) => {
      const metric = client.dailyMetrics[0];
      const reportLog = client.reportLogs[0];

      const conversions = metric?.conversions ?? 0;
      const callConversions = metric?.callConversions ?? 0;
      const whatsappConversions = metric?.whatsappConversions ?? 0;
      const clicks = metric?.clicks ?? 0;
      const impressions = metric?.impressions ?? 0;
      const ctr = metric?.ctr ?? 0;
      const avgCpc = metric?.avgCpc ?? 0;
      const cost = metric?.cost ?? 0;

      const cpa = conversions > 0 ? Number((cost / conversions).toFixed(2)) : 0;
      const highCpaThreshold = client.highCpaThreshold ?? 60.0;

      // Status Flags
      const flags: string[] = [];
      if (!metric) {
        flags.push("Data missing");
      } else {
        if (cost > 0 && conversions === 0) {
          flags.push("No conversions");
        }
        if (conversions > 0 && cpa > highCpaThreshold) {
          flags.push("High CPA");
        }
      }

      const reportStatus = reportLog?.status ?? "NOT_SENT";
      if (reportStatus === "FAILED") {
        flags.push("Report failed");
      } else if (reportStatus === "NOT_SENT" || reportStatus === "PENDING") {
        flags.push("Report pending");
      }

      const needsAttention = flags.filter((f) => f !== "Report pending").length > 0;
      if (needsAttention) {
        needsAttentionCount++;
      }

      totalConversions += conversions;
      totalCost += cost;
      totalClicks += clicks;

      let perService: Record<string, number> = {};
      try {
        if (metric?.perService) {
          perService = JSON.parse(metric.perService);
        }
      } catch (e) {
        perService = {};
      }

      return {
        id: client.id,
        name: client.name,
        specialistName: client.specialistName || "Unassigned",
        specialistId: client.specialistId,
        currency: client.currency,
        highCpaThreshold,
        requiresApproval: client.requiresApproval,
        googleAdsAccount: client.googleAdsAccounts[0]
          ? {
              customerId: client.googleAdsAccounts[0].customerId,
              loginCustomerId: client.googleAdsAccounts[0].loginCustomerId,
              status: client.googleAdsAccounts[0].status,
            }
          : null,
        whatsappGroup: client.whatsappGroup
          ? {
              groupId: client.whatsappGroup.groupId,
              fallbackPhone: client.whatsappGroup.fallbackPhone,
              status: client.whatsappGroup.status,
            }
          : null,
        metrics: metric
          ? {
              clicks,
              impressions,
              ctr,
              avgCpc,
              cost,
              conversions,
              callConversions,
              whatsappConversions,
              cpa,
              perService,
            }
          : null,
        reportLog: reportLog
          ? {
              status: reportLog.status,
              sentAt: reportLog.sentAt,
              error: reportLog.error,
              retries: reportLog.retries,
            }
          : null,
        flags,
        needsAttention,
      };
    });

    const averageCpa =
      totalConversions > 0 ? Number((totalCost / totalConversions).toFixed(2)) : 0;

    return NextResponse.json({
      success: true,
      viewer: { name: user.name, role: user.role },
      date,
      summary: {
        totalCompanies: clients.length,
        totalConversions: Number(totalConversions.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        totalClicks,
        averageCpa,
        needsAttentionCount,
      },
      clients: rows,
      specialists: specialists.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
      })),
    });
  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
