import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

// Everything requires a login except these. Role checks (admin vs specialist)
// happen in the route handlers, which re-read the user from the database.
const PUBLIC_PREFIXES = [
  "/login",
  "/r/", // client portal (share token)
  "/api/auth/",
  "/api/portal/",
  "/api/report-card/", // fetched by WhatsApp's servers when sending images
  "/api/cron/", // protected by CRON_SECRET
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "Please log in." }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
