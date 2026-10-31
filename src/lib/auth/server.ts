import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "../prisma";
import { SESSION_COOKIE, verifySession } from "./session";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SPECIALIST";
}

/**
 * The logged-in user, re-read from the database so role changes and deleted
 * users take effect immediately rather than when the cookie expires.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || !user.passwordHash) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "ADMIN" ? "ADMIN" : "SPECIALIST",
  };
}

export const isAdmin = (user: CurrentUser) => user.role === "ADMIN";

/** Prisma `where` that limits clients to the ones this user may see. */
export function clientScope(user: CurrentUser) {
  return isAdmin(user) ? {} : { specialistId: user.id };
}

export async function canAccessClient(user: CurrentUser, clientId: string) {
  if (isAdmin(user)) return true;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { specialistId: true } });
  return client?.specialistId === user.id;
}

/** Returns an error response unless the caller is an admin. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();
  return null;
}

/** A user row without its password hash, safe to send to the browser. */
export function publicUser<T extends { passwordHash?: string | null }>(user: T) {
  const { passwordHash, ...rest } = user;
  return { ...rest, hasPassword: Boolean(passwordHash) };
}

export const unauthorized = () =>
  NextResponse.json({ success: false, error: "Please log in." }, { status: 401 });

export const forbidden = () =>
  NextResponse.json({ success: false, error: "You don't have access to this." }, { status: 403 });
