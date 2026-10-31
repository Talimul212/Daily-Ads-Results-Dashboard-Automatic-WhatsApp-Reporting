import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { CampaignRange, getCampaignReport } from "@/lib/google-ads/googleAds";
import { forbidden, getCurrentUser, isAdmin, unauthorized } from "@/lib/auth/server";
import { resolveDateRange } from "@/lib/date-range";

export const dynamic = "force-dynamic";

const RANGES: CampaignRange[] = [
  "LAST_7_DAYS",
  "LAST_14_DAYS",
  "LAST_30_DAYS",
  "LAST_MONTH",
  "THIS_MONTH",
];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const customerId = (searchParams.get("customerId") || "").replace(/\D/g, "");
  const range = searchParams.get("range") as CampaignRange | null;

  if (customerId.length !== 10) {
    return NextResponse.json(
      { success: false, error: "Customer ID must be 10 digits, e.g. 123-456-7890." },
      { status: 400 }
    );
  }
  if (range && !RANGES.includes(range)) {
    return NextResponse.json(
      { success: false, error: `Unsupported range "${range}".` },
      { status: 400 }
    );
  }

  // Specialists may only query accounts of clients assigned to them.
  if (!isAdmin(user)) {
    const accounts = await prisma.googleAdsAccount.findMany({
      where: { client: { specialistId: user.id } },
      select: { customerId: true },
    });
    if (!accounts.some((a) => a.customerId.replace(/\D/g, "") === customerId)) return forbidden();
  }

  let dates: { start: string; end: string } | undefined;
  if (searchParams.get("start") || searchParams.get("end")) {
    const resolved = resolveDateRange(searchParams);
    if ("error" in resolved) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: 400 });
    }
    dates = { start: resolved.startDate, end: resolved.endDate };
  }

  const result = await getCampaignReport(customerId, dates ?? range ?? undefined);
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
