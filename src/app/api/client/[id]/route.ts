import { NextRequest, NextResponse } from "next/server";
import { canAccessClient, forbidden, getCurrentUser, unauthorized } from "@/lib/auth/server";
import { resolveDateRange } from "@/lib/date-range";
import { loadAccountReport } from "@/lib/account-report";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!(await canAccessClient(user, params.id))) return forbidden();

  const range = resolveDateRange(new URL(req.url).searchParams);
  if ("error" in range) {
    return NextResponse.json({ success: false, error: range.error }, { status: 400 });
  }

  try {
    const report = await loadAccountReport({ id: params.id }, range.startDate, range.endDate);
    if (!report) {
      return NextResponse.json({ success: false, error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...report });
  } catch (error: any) {
    console.error("Client API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch client details" },
      { status: 500 }
    );
  }
}
