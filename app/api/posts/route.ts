import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { seedPost, type Post } from "../../content";

type RuntimeEnv = { DB: D1Database };

async function ensureDatabase() {
  const db = (env as unknown as RuntimeEnv).DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      category TEXT NOT NULL,
      author TEXT NOT NULL,
      published_at TEXT NOT NULL,
      read_time TEXT NOT NULL,
      tags TEXT NOT NULL,
      blocks TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS posts_slug_idx ON posts (slug)"),
  ]);

  const existing = await db.prepare("SELECT id FROM posts WHERE slug = ?").bind(seedPost.slug).first();
  if (!existing) {
    await db.prepare(`INSERT INTO posts
      (id, slug, title, excerpt, category, author, published_at, read_time, tags, blocks, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(seedPost.id, seedPost.slug, seedPost.title, seedPost.excerpt, seedPost.category, seedPost.author, seedPost.publishedAt, seedPost.readTime, JSON.stringify(seedPost.tags), JSON.stringify(seedPost.blocks), new Date().toISOString())
      .run();
  } else {
    await db.prepare("UPDATE posts SET category = ?, updated_at = ? WHERE id = ?")
      .bind(seedPost.category, new Date().toISOString(), seedPost.id)
      .run();
  }
  return db;
}

function rowToPost(row: Record<string, unknown>): Post {
  return {
    id: String(row.id), slug: String(row.slug), title: String(row.title), excerpt: String(row.excerpt),
    category: String(row.category), author: String(row.author), publishedAt: String(row.published_at),
    readTime: String(row.read_time), tags: JSON.parse(String(row.tags)), blocks: JSON.parse(String(row.blocks)),
  };
}

export async function GET(request: NextRequest) {
  const db = await ensureDatabase();
  const slug = request.nextUrl.searchParams.get("slug") ?? seedPost.slug;
  const row = await db.prepare("SELECT * FROM posts WHERE slug = ?").bind(slug).first<Record<string, unknown>>();
  if (!row) return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(rowToPost(row));
}

export async function PUT(request: NextRequest) {
  const db = await ensureDatabase();
  const post = (await request.json()) as Post;
  if (!post?.id || !post?.slug || !post?.title || !Array.isArray(post.blocks)) {
    return NextResponse.json({ error: "저장할 게시물 형식이 올바르지 않습니다." }, { status: 400 });
  }
  await db.prepare(`UPDATE posts SET title = ?, excerpt = ?, category = ?, author = ?, published_at = ?,
    read_time = ?, tags = ?, blocks = ?, updated_at = ? WHERE id = ?`)
    .bind(post.title, post.excerpt, post.category, post.author, post.publishedAt, post.readTime,
      JSON.stringify(post.tags), JSON.stringify(post.blocks), new Date().toISOString(), post.id)
    .run();
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
