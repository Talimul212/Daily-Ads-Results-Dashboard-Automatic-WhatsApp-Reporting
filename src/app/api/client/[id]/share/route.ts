import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canAccessClient, forbidden, getCurrentUser, unauthorized } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const shareUrl = (req: NextRequest, token: string) =>
  `${process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin}/r/${token}`;

async function guard(clientId: string) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!(await canAccessClient(user, clientId))) return forbidden();
  return null;
}

/** Current share link, if one is enabled. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard(params.id);
  if (denied) return denied;

  const client = await prisma.client.findUnique({ where: { id: params.id }, select: { shareToken: true } });
  return NextResponse.json({
    success: true,
    url: client?.shareToken ? shareUrl(req, client.shareToken) : null,
  });
}

/** Create the link, or replace it with `{ "rotate": true }` (old link stops working). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard(params.id);
  if (denied) return denied;

  const { rotate } = await req.json().catch(() => ({}));
  const existing = await prisma.client.findUnique({ where: { id: params.id }, select: { shareToken: true } });
  if (!existing) return NextResponse.json({ success: false, error: "Client not found" }, { status: 404 });

  let token = existing.shareToken;
  if (!token || rotate) {
    token = randomBytes(24).toString("base64url");
    await prisma.client.update({ where: { id: params.id }, data: { shareToken: token } });
  }
  return NextResponse.json({ success: true, url: shareUrl(req, token) });
}

/** Turn the link off. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard(params.id);
  if (denied) return denied;

  await prisma.client.update({ where: { id: params.id }, data: { shareToken: null } });
  return NextResponse.json({ success: true, url: null });
}
