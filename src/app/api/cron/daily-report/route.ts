import { NextRequest, NextResponse } from "next/server";
import { syncDailyGoogleAdsMetrics } from "@/lib/services/sync-service";
import { dispatchClientDailyReport } from "@/lib/whatsapp/client";
import { getYesterdayDateInTimezone } from "@/lib/google-ads/queries";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow 5 minutes on Vercel Pro/serverless

export async function GET(req: NextRequest) {
  return handleDailyCron(req);
}

export async function POST(req: NextRequest) {
  return handleDailyCron(req);
}

async function handleDailyCron(req: NextRequest) {
  // 1. Authorization check
  const authHeader = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const secretParam = searchParams.get("secret");
  const configuredSecret = process.env.CRON_SECRET;

  if (configuredSecret) {
    const isAuthorized =
      authHeader === `Bearer ${configuredSecret}` || secretParam === configuredSecret;
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const targetDate = getYesterdayDateInTimezone("Asia/Singapore");
  const startTime = Date.now();

  try {
    // 2. Step 1: Pull Google Ads Data for yesterday
    const syncSummary = await syncDailyGoogleAdsMetrics({
      date: targetDate,
      useMockIfUnconfigured: true,
    });

    // 3. Step 2: Auto-send WhatsApp reports for clients not requiring manual approval
    const activeClients = await prisma.client.findMany({
      where: { active: true },
      include: {
        reportLogs: { where: { date: targetDate } },
      },
    });

    const dispatchResults: any[] = [];
    let sentCount = 0;
    let pendingApprovalCount = 0;
    let failedSendCount = 0;

    for (const client of activeClients) {
      if (client.requiresApproval) {
        pendingApprovalCount++;
        dispatchResults.push({
          clientId: client.id,
          clientName: client.name,
          status: "PENDING_APPROVAL",
        });
        continue;
      }

      // If already sent, skip (idempotency)
      if (client.reportLogs[0]?.status === "SENT") {
        sentCount++;
        dispatchResults.push({
          clientId: client.id,
          clientName: client.name,
          status: "ALREADY_SENT",
        });
        continue;
      }

      try {
        const sendRes = await dispatchClientDailyReport(client.id, targetDate);
        if (sendRes.success) {
          sentCount++;
          dispatchResults.push({
            clientId: client.id,
            clientName: client.name,
            status: "SENT",
            mode: sendRes.mode,
          });
        } else {
          failedSendCount++;
          dispatchResults.push({
            clientId: client.id,
            clientName: client.name,
            status: "FAILED",
            error: sendRes.error,
          });
        }
      } catch (sendErr: any) {
        failedSendCount++;
        dispatchResults.push({
          clientId: client.id,
          clientName: client.name,
          status: "FAILED",
          error: sendErr.message,
        });
      }
    }

    // 4. Record audit log
    await prisma.auditLog.create({
      data: {
        action: "CRON_DAILY_RUN",
        details: JSON.stringify({
          date: targetDate,
          syncSummary,
          sentCount,
          pendingApprovalCount,
          failedSendCount,
          durationMs: Date.now() - startTime,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      date: targetDate,
      durationMs: Date.now() - startTime,
      syncSummary,
      dispatch: {
        total: activeClients.length,
        sent: sentCount,
        pendingApproval: pendingApprovalCount,
        failed: failedSendCount,
        results: dispatchResults,
      },
    });
  } catch (err: any) {
    console.error("Cron run failed:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Cron execution failed" },
      { status: 500 }
    );
  }
}
