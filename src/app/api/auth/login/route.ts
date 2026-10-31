import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ success: false, error: "Enter your email and password." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: String(email).trim(), mode: "insensitive" } },
  });

  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    return NextResponse.json({ success: false, error: "Wrong email or password." }, { status: 401 });
  }

  const res = NextResponse.json({ success: true, user: { name: user.name, role: user.role } });
  res.cookies.set(SESSION_COOKIE, await signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
