import { NextRequest, NextResponse } from "next/server";
import { syncDailyGoogleAdsMetrics } from "@/lib/services/sync-service";
import { canAccessClient, forbidden, getCurrentUser, isAdmin, unauthorized } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json().catch(() => ({}));
    const { clientId, date, startDate } = body;

    if (clientId && !(await canAccessClient(user, clientId))) return forbidden();

    const summary = await syncDailyGoogleAdsMetrics({
      clientId: clientId || undefined,
      // Specialists syncing "everything" only sync their own clients.
      specialistId: isAdmin(user) ? undefined : user.id,
      date: date || undefined,
      startDate: startDate || undefined,
      useMockIfUnconfigured: true,
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    console.error("Sync API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to trigger sync" },
      { status: 500 }
    );
  }
}
