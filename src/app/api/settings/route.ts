import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { publicUser, requireAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const clients = await prisma.client.findMany({
      include: {
        googleAdsAccounts: true,
        campaignServiceMaps: true,
        conversionActionMaps: true,
        whatsappGroup: true,
      },
      orderBy: { name: "asc" },
    });

    const specialists = await prisma.user.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      clients,
      specialists: specialists.map(publicUser),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const {
      name,
      specialistId,
      specialistName,
      timezone,
      currency,
      highCpaThreshold,
      requiresApproval,
      customerId,
      loginCustomerId,
      campaignMaps,
      conversionMaps,
      whatsappGroupId,
      whatsappFallbackPhone,
    } = body;

    if (!name || !customerId) {
      return NextResponse.json(
        { success: false, error: "Client Name and Google Ads Customer ID are required" },
        { status: 400 }
      );
    }

    // Create client
    const newClient = await prisma.client.create({
      data: {
        name,
        specialistId: specialistId || null,
        specialistName: specialistName || null,
        timezone: timezone || "Asia/Singapore",
        currency: currency || "SGD",
        highCpaThreshold: highCpaThreshold ? parseFloat(highCpaThreshold) : 60.0,
        requiresApproval: Boolean(requiresApproval),
        active: true,
        googleAdsAccounts: {
          create: {
            customerId,
            loginCustomerId: loginCustomerId || null,
            status: "ACTIVE",
          },
        },
        whatsappGroup: {
          create: {
            groupId: whatsappGroupId || null,
            fallbackPhone: whatsappFallbackPhone || null,
            status: "ACTIVE",
          },
        },
      },
    });

    // Add campaign mappings if provided
    if (Array.isArray(campaignMaps)) {
      for (const map of campaignMaps) {
        if (map.pattern && map.label) {
          await prisma.campaignServiceMap.create({
            data: {
              clientId: newClient.id,
              campaignNamePattern: map.pattern,
              serviceLabel: map.label,
            },
          });
        }
      }
    }

    // Add conversion action mappings if provided
    if (Array.isArray(conversionMaps)) {
      for (const map of conversionMaps) {
        if (map.name && map.type) {
          await prisma.conversionActionMap.create({
            data: {
              clientId: newClient.id,
              conversionActionName: map.name,
              type: map.type,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      client: newClient,
    });
  } catch (error: any) {
    console.error("Create client error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create client" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const {
      id,
      name,
      specialistId,
      specialistName,
      timezone,
      currency,
      highCpaThreshold,
      requiresApproval,
      active,
      customerId,
      loginCustomerId,
      campaignMaps,
      conversionMaps,
      whatsappGroupId,
      whatsappFallbackPhone,
    } = body;

    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: "Missing required client id or name" },
        { status: 400 }
      );
    }

    // Update Client Base
    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        name,
        specialistId: specialistId || null,
        specialistName: specialistName || null,
        timezone: timezone || "Asia/Singapore",
        currency: currency || "SGD",
        highCpaThreshold: highCpaThreshold ? parseFloat(highCpaThreshold) : 60.0,
        requiresApproval: Boolean(requiresApproval),
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    // Update or Upsert Google Ads Account
    if (customerId) {
      const existingAccount = await prisma.googleAdsAccount.findFirst({
        where: { clientId: id },
      });
      if (existingAccount) {
        await prisma.googleAdsAccount.update({
          where: { id: existingAccount.id },
          data: {
            customerId,
            loginCustomerId: loginCustomerId || null,
          },
        });
      } else {
        await prisma.googleAdsAccount.create({
          data: {
            clientId: id,
            customerId,
            loginCustomerId: loginCustomerId || null,
            status: "ACTIVE",
          },
        });
      }
    }

    // Update or Upsert WhatsApp Group
    const existingWa = await prisma.whatsAppGroup.findFirst({
      where: { clientId: id },
    });
    if (existingWa) {
      await prisma.whatsAppGroup.update({
        where: { id: existingWa.id },
        data: {
          groupId: whatsappGroupId || null,
          fallbackPhone: whatsappFallbackPhone || null,
        },
      });
    } else {
      await prisma.whatsAppGroup.create({
        data: {
          clientId: id,
          groupId: whatsappGroupId || null,
          fallbackPhone: whatsappFallbackPhone || null,
          status: "ACTIVE",
        },
      });
    }

    // Update campaign maps if provided
    if (Array.isArray(campaignMaps)) {
      await prisma.campaignServiceMap.deleteMany({ where: { clientId: id } });
      for (const map of campaignMaps) {
        if (map.pattern && map.label) {
          await prisma.campaignServiceMap.create({
            data: {
              clientId: id,
              campaignNamePattern: map.pattern,
              serviceLabel: map.label,
            },
          });
        }
      }
    }

    // Update conversion maps if provided
    if (Array.isArray(conversionMaps)) {
      await prisma.conversionActionMap.deleteMany({ where: { clientId: id } });
      for (const map of conversionMaps) {
        if (map.name && map.type) {
          await prisma.conversionActionMap.create({
            data: {
              clientId: id,
              conversionActionName: map.name,
              type: map.type,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      client: updatedClient,
    });
  } catch (error: any) {
    console.error("Update client error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update client" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const { id, active } = body;

    if (!id || active === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing client id or active status" },
        { status: 400 }
      );
    }

    const updated = await prisma.client.update({
      where: { id },
      data: { active: Boolean(active) },
    });

    return NextResponse.json({
      success: true,
      client: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to toggle active status" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing client ID to delete" },
        { status: 400 }
      );
    }

    // Delete related records and client
    await prisma.client.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete client" },
      { status: 500 }
    );
  }
}
