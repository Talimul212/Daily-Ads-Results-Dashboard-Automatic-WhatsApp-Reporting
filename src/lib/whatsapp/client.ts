import prisma from "@/lib/prisma";
import { generateWhatsAppCaption, generateReportCardSvg } from "../reporting/report-card";

export interface SendReportResult {
  success: boolean;
  messageId?: string;
  mode?: "GROUP" | "DIRECT_FALLBACK" | "SIMULATED";
  error?: string;
  caption: string;
}

/**
 * Uploads media (SVG/PNG) to Meta WhatsApp Cloud API to obtain a media ID.
 */
export async function uploadWhatsAppMedia(
  imageBuffer: Buffer,
  fileName: string = "report-card.png",
  mimeType: string = "image/png"
): Promise<string> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";

  if (!token || !phoneNumberId) {
    throw new Error("Missing Meta WhatsApp Cloud API credentials in environment variables");
  }

  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("type", mimeType);
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  formData.append("file", blob, fileName);

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`WhatsApp Media Upload Failed: ${data.error?.message || JSON.stringify(data)}`);
  }

  return data.id as string;
}

/**
 * Sends a media message (image + caption) to a WhatsApp Group or direct phone number.
 */
export async function sendWhatsAppMediaMessage(options: {
  to: string; // Group ID (e.g. 120363029182746591@g.us) or Phone (+6591234567)
  isGroup: boolean;
  mediaId?: string;
  imageUrl?: string;
  caption: string;
}): Promise<{ messageId: string }> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";

  if (!token || !phoneNumberId) {
    throw new Error("Missing Meta WhatsApp Cloud API credentials");
  }

  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: options.isGroup ? "group" : "individual",
    to: options.to,
    type: "image",
    image: {
      ...(options.mediaId ? { id: options.mediaId } : { link: options.imageUrl }),
      caption: options.caption,
    },
  };

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`WhatsApp Send Message Failed: ${data.error?.message || JSON.stringify(data)}`);
  }

  return { messageId: data.messages?.[0]?.id || "unknown" };
}

/**
 * Complete idempotent workflow:
 * 1. Verifies existing report log to prevent duplicate sends.
 * 2. Prepares metrics & formatted caption.
 * 3. Attempts WhatsApp Group send -> falls back to direct 1-to-1 if configured.
 * 4. Logs output and updates report_logs table.
 */
export async function dispatchClientDailyReport(
  clientId: string,
  date: string,
  forceResend: boolean = false
): Promise<SendReportResult> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      whatsappGroup: true,
      dailyMetrics: {
        where: { date },
      },
      reportLogs: {
        where: { date },
      },
    },
  });

  if (!client) {
    throw new Error(`Client with id ${clientId} not found`);
  }

  const existingLog = client.reportLogs[0];
  if (existingLog?.status === "SENT" && !forceResend) {
    return {
      success: true,
      caption: existingLog.caption || "",
      messageId: "already-sent",
      mode: "SIMULATED",
    };
  }

  const metric = client.dailyMetrics[0];
  if (!metric) {
    throw new Error(`No daily metrics found for client ${client.name} on date ${date}`);
  }

  // Parse JSON data
  const perService = JSON.parse(metric.perService || "{}");
  const hourlyMetrics = JSON.parse(metric.hourlyMetrics || "[]");

  const reportData = {
    clientName: client.name,
    date,
    currency: client.currency,
    clicks: metric.clicks,
    impressions: metric.impressions,
    ctr: metric.ctr,
    avgCpc: metric.avgCpc,
    cost: metric.cost,
    conversions: metric.conversions,
    callConversions: metric.callConversions,
    whatsappConversions: metric.whatsappConversions,
    perService,
    hourlyMetrics,
  };

  const caption = generateWhatsAppCaption(reportData);
  const isWhatsAppConfigured = Boolean(
    process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  );

  const groupTarget = client.whatsappGroup?.groupId;
  const fallbackPhone = client.whatsappGroup?.fallbackPhone;

  let sendMode: "GROUP" | "DIRECT_FALLBACK" | "SIMULATED" = "SIMULATED";
  let messageId = `sim_${Date.now()}`;

  try {
    if (isWhatsAppConfigured) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const imageUrl = `${appUrl}/api/report-card/preview/${client.id}?date=${date}`;

      if (groupTarget) {
        try {
          sendMode = "GROUP";
          const res = await sendWhatsAppMediaMessage({
            to: groupTarget,
            isGroup: true,
            imageUrl,
            caption,
          });
          messageId = res.messageId;
        } catch (groupErr: any) {
          console.warn(`Group send failed, trying 1-to-1 fallback: ${groupErr.message}`);
          if (fallbackPhone) {
            sendMode = "DIRECT_FALLBACK";
            const res = await sendWhatsAppMediaMessage({
              to: fallbackPhone,
              isGroup: false,
              imageUrl,
              caption,
            });
            messageId = res.messageId;
          } else {
            throw groupErr;
          }
        }
      } else if (fallbackPhone) {
        sendMode = "DIRECT_FALLBACK";
        const res = await sendWhatsAppMediaMessage({
          to: fallbackPhone,
          isGroup: false,
          imageUrl,
          caption,
        });
        messageId = res.messageId;
      } else {
        throw new Error("No WhatsApp group ID or fallback phone number configured for this client");
      }
    } else {
      // Running in verified simulation mode
      sendMode = "SIMULATED";
      console.log(`[SIMULATED WHATSAPP DISPATCH] To: ${client.name} (${groupTarget || fallbackPhone || "unassigned"})`);
      console.log(caption);
    }

    // Update ReportLog to SENT
    await prisma.reportLog.upsert({
      where: {
        clientId_date: {
          clientId: client.id,
          date,
        },
      },
      create: {
        clientId: client.id,
        date,
        status: "SENT",
        caption,
        imageUrl: `/api/report-card/preview/${client.id}?date=${date}`,
        sentAt: new Date(),
        retries: (existingLog?.retries || 0) + 1,
      },
      update: {
        status: "SENT",
        caption,
        imageUrl: `/api/report-card/preview/${client.id}?date=${date}`,
        sentAt: new Date(),
        error: null,
        retries: (existingLog?.retries || 0) + 1,
      },
    });

    return {
      success: true,
      messageId,
      mode: sendMode,
      caption,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);

    // Update ReportLog to FAILED
    await prisma.reportLog.upsert({
      where: {
        clientId_date: {
          clientId: client.id,
          date,
        },
      },
      create: {
        clientId: client.id,
        date,
        status: "FAILED",
        error: errorMsg,
        retries: (existingLog?.retries || 0) + 1,
      },
      update: {
        status: "FAILED",
        error: errorMsg,
        retries: (existingLog?.retries || 0) + 1,
      },
    });

    return {
      success: false,
      error: errorMsg,
      caption,
    };
  }
}
