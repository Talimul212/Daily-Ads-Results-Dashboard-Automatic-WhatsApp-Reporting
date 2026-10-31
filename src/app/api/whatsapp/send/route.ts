import { NextRequest, NextResponse } from "next/server";
import { dispatchClientDailyReport } from "@/lib/whatsapp/client";
import { canAccessClient, forbidden, getCurrentUser, unauthorized } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const { clientId, date, forceResend } = body;

    if (!clientId || !date) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: clientId, date" },
        { status: 400 }
      );
    }
    if (!(await canAccessClient(user, clientId))) return forbidden();

    const result = await dispatchClientDailyReport(clientId, date, Boolean(forceResend));

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("WhatsApp dispatch error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to dispatch WhatsApp report" },
      { status: 500 }
    );
  }
}
