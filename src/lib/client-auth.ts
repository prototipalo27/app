import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import crypto from "crypto";

const PENDING_COOKIE = "client_pending";
const VERIFIED_COOKIE = "client_verified";

function getSecret() {
  const secret = process.env.CLIENT_VERIFY_SECRET;
  if (!secret) throw new Error("CLIENT_VERIFY_SECRET env var is required");
  return new TextEncoder().encode(secret);
}

export function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function createPendingToken(
  code: string,
  email: string,
  projectId: string,
): Promise<string> {
  return new SignJWT({ code, email, projectId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(getSecret());
}

export async function createVerifiedToken(
  email: string,
  projectId: string,
): Promise<string> {
  return new SignJWT({ email, projectId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyToken(
  token: string,
): Promise<{ email: string; projectId: string; code?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { email: string; projectId: string; code?: string };
  } catch {
    return null;
  }
}

export async function setPendingCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 min
    path: "/",
  });
}

export async function setVerifiedCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(VERIFIED_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

export async function deletePendingCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_COOKIE);
}

export async function getPendingToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(PENDING_COOKIE)?.value;
}

export async function getVerifiedClient(
  projectId: string,
): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(VERIFIED_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || payload.projectId !== projectId) return null;

  return payload.email;
}
