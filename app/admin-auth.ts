import { env } from "cloudflare:workers";
import { headers } from "next/headers";

type RuntimeEnv = {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  ADMIN_PROXY_SHARED_SECRET?: string;
};

type AccessPayload = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iss?: string;
  nbf?: number;
};

type AccessHeader = { alg?: string; kid?: string };
type Jwks = { keys?: JsonWebKey[] };

let cachedJwks: { expiresAt: number; value: Jwks } | null = null;

function base64UrlBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlBytes(value))) as T;
  } catch {
    return null;
  }
}

function normalizeTeamDomain(value: string) {
  return value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

async function getJwks(issuer: string, forceRefresh = false) {
  if (!forceRefresh && cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.value;
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const value = await response.json() as Jwks;
  cachedJwks = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
  return value;
}

async function verifyAccessToken(token: string, teamDomain: string, audience: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const tokenHeader = decodeJson<AccessHeader>(parts[0]);
  const payload = decodeJson<AccessPayload>(parts[1]);
  if (!tokenHeader?.kid || tokenHeader.alg !== "RS256" || !payload) return null;

  const issuer = `https://${normalizeTeamDomain(teamDomain)}`;
  const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== issuer || !audiences.includes(audience) || !payload.exp || payload.exp < now - 60 || (payload.nbf && payload.nbf > now + 60)) return null;

  let jwks = await getJwks(issuer);
  let jwk = jwks?.keys?.find((candidate) => candidate.kid === tokenHeader.kid);
  if (!jwk) {
    jwks = await getJwks(issuer, true);
    jwk = jwks?.keys?.find((candidate) => candidate.kid === tokenHeader.kid);
  }
  if (!jwk) return null;

  try {
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    return verified ? payload : null;
  } catch {
    return null;
  }
}

export async function getAdminUser() {
  const runtime = env as unknown as RuntimeEnv;
  const teamDomain = runtime.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = runtime.CF_ACCESS_AUD?.trim();
  const allowedEmails = new Set((runtime.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
  if (!allowedEmails.size) return null;

  const requestHeaders = await headers();
  const proxySecret = requestHeaders.get("x-ai-coe-proxy-secret");
  const proxyEmail = requestHeaders.get("x-ai-coe-access-email")?.trim().toLowerCase();
  if (runtime.ADMIN_PROXY_SHARED_SECRET && proxySecret === runtime.ADMIN_PROXY_SHARED_SECRET && proxyEmail && allowedEmails.has(proxyEmail)) {
    return { email: proxyEmail };
  }

  if (!teamDomain || !audience) return null;
  const token = requestHeaders.get("cf-access-jwt-assertion") ?? requestHeaders.get("x-ai-coe-access-token");
  if (!token) return null;
  const payload = await verifyAccessToken(token, teamDomain, audience);
  const email = payload?.email?.trim().toLowerCase();
  return email && allowedEmails.has(email) ? { email } : null;
}

export async function isAdminUser() {
  return Boolean(await getAdminUser());
}
