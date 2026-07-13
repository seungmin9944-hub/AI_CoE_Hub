import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "../../admin-auth";
import { defaultSiteSettings, normalizeSiteSettings, type SiteSettings } from "../../site-settings";

type RuntimeEnv = { DB: D1Database };

async function ensureSettingsTable() {
  const db = (env as unknown as RuntimeEnv).DB;
  await db.prepare(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare("INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)")
    .bind("navigation", JSON.stringify(defaultSiteSettings), new Date().toISOString()).run();
  return db;
}

export async function GET() {
  const db = await ensureSettingsTable();
  const row = await db.prepare("SELECT value FROM site_settings WHERE key = ?").bind("navigation").first<{ value: string }>();
  let parsed: Partial<SiteSettings> | null = null;
  try {
    parsed = row?.value ? JSON.parse(row.value) as Partial<SiteSettings> : null;
  } catch {
    parsed = null;
  }
  return NextResponse.json(normalizeSiteSettings(parsed));
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminUser())) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 });
  const db = await ensureSettingsTable();
  const body = await request.json().catch(() => null) as Partial<SiteSettings> | null;
  const settings = normalizeSiteSettings(body);
  await db.prepare(`INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .bind("navigation", JSON.stringify(settings), new Date().toISOString()).run();
  return NextResponse.json(settings);
}
