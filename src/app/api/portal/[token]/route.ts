import { NextRequest, NextResponse } from "next/server";
import { resolveDateRange } from "@/lib/date-range";
import { loadAccountReport } from "@/lib/account-report";
import { getCampaignReport } from "@/lib/google-ads/googleAds";

export const dynamic = "force-dynamic";

/**
 * Read-only data for a client's share link (/r/<token>). No login; the token
 * is the credential. `?campaigns=1` returns the live campaign table instead.
 */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const searchParams = new URL(req.url).searchParams;
  const range = resolveDateRange(searchParams);
  if ("error" in range) {
    return NextResponse.json({ success: false, error: range.error }, { status: 400 });
  }

  const report = await loadAccountReport({ shareToken: params.token }, range.startDate, range.endDate, true);
  if (!report) {
    return NextResponse.json(
      { success: false, error: "This report link is no longer active. Ask your account manager for a new one." },
      { status: 404 }
    );
  }

  if (searchParams.get("campaigns")) {
    if (!report.client.customerId) return NextResponse.json({ success: true, reports: [] });
    const result = await getCampaignReport(report.client.customerId, { start: range.startDate, end: range.endDate });
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  }

  return NextResponse.json({ success: true, ...report });
}
