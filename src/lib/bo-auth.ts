import crypto from "crypto";
import { cookies } from "next/headers";

// ─── Session du Back-Office plateforme (totalement séparée du NextAuth des écoles) ───
// Cookie httpOnly signé HMAC-SHA256, scellé au domaine admin.

const SECRET = process.env.BO_SESSION_SECRET || process.env.NEXTAUTH_SECRET || "bo-dev-secret-change-me";
const COOKIE = "bo_session";
const MAX_AGE = 12 * 60 * 60; // 12h

export type BoSession = { id: string; email: string; name: string; role: string; exp: number };

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createToken(admin: { id: string; email: string; name: string; role: string }): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ id: admin.id, email: admin.email, name: admin.name, role: admin.role, exp })).toString("base64url");
  return payload + "." + sign(payload);
}

export function verifyToken(token?: string | null): BoSession | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  // Comparaison à temps constant
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as BoSession;
    if (!data.exp || data.exp * 1000 < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function setBoCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getBoSession(): Promise<BoSession | null> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE)?.value);
}

export async function clearBoCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}
