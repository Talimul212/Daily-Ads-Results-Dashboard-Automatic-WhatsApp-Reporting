import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/server";
import { describeGoogleAdsError, getCustomerInstance } from "@/lib/google-ads/client";

export const dynamic = "force-dynamic";

const digits = (id: string | null | undefined) => (id || "").replace(/\D/g, "");

/**
 * Create a client for every enabled sub-account under the MCC in
 * GOOGLE_ADS_LOGIN_CUSTOMER_ID that isn't linked yet. Costs 1 API operation.
 */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const mcc = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (!mcc) {
    return NextResponse.json(
      { success: false, error: "Set GOOGLE_ADS_LOGIN_CUSTOMER_ID to your MCC ID first." },
      { status: 400 }
    );
  }

  let rows: any[];
  try {
    rows = await getCustomerInstance({ customerId: mcc, loginCustomerId: mcc }).query(`
      SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.time_zone,
        customer_client.manager,
        customer_client.status
      FROM customer_client
      WHERE customer_client.level = 1
        AND customer_client.manager = FALSE
        AND customer_client.status = 'ENABLED'
    `);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: describeGoogleAdsError(error) },
      { status: 502 }
    );
  }

  const linked = new Set(
    (await prisma.googleAdsAccount.findMany({ select: { customerId: true } })).map((a) =>
      digits(a.customerId)
    )
  );

  const created: { name: string; customerId: string }[] = [];
  for (const row of rows) {
    const c = row.customer_client;
    const customerId = String(c.id);
    if (linked.has(customerId)) continue;

    const name = c.descriptive_name || `Account ${customerId}`;
    await prisma.client.create({
      data: {
        name,
        currency: c.currency_code || "SGD",
        timezone: c.time_zone || "Asia/Singapore",
        googleAdsAccounts: { create: { customerId, loginCustomerId: mcc } },
      },
    });
    created.push({ name, customerId });
  }

  await prisma.auditLog.create({
    data: {
      action: "MCC_IMPORT",
      details: JSON.stringify({ mcc, found: rows.length, created }),
    },
  });

  return NextResponse.json({
    success: true,
    found: rows.length,
    alreadyLinked: rows.length - created.length,
    created,
  });
}
