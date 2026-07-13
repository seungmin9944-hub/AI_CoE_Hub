import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { seedPost, type Post } from "../../content";
import { isAdminUser } from "../../admin-auth";

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
      toc_title TEXT NOT NULL DEFAULT 'ON THIS PAGE',
      tags TEXT NOT NULL,
      blocks TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS posts_slug_idx ON posts (slug)"),
    db.prepare("CREATE INDEX IF NOT EXISTS posts_category_idx ON posts (category)"),
  ]);

  const columns = await db.prepare("PRAGMA table_info(posts)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "toc_title")) {
    await db.prepare("ALTER TABLE posts ADD COLUMN toc_title TEXT NOT NULL DEFAULT 'ON THIS PAGE'").run();
  }

  const existing = await db.prepare("SELECT id FROM posts WHERE slug = ?").bind(seedPost.slug).first<{ id: string }>();
  if (!existing) {
    await db.prepare(`INSERT INTO posts
      (id, slug, title, excerpt, category, author, published_at, read_time, toc_title, tags, blocks, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(seedPost.id, seedPost.slug, seedPost.title, seedPost.excerpt, seedPost.category, seedPost.author,
        seedPost.publishedAt, seedPost.readTime, seedPost.tocTitle, JSON.stringify(seedPost.tags),
        JSON.stringify(seedPost.blocks), new Date().toISOString())
      .run();
  }
  return db;
}

function rowToPost(row: Record<string, unknown>): Post {
  return {
    id: String(row.id), slug: String(row.slug), title: String(row.title), excerpt: String(row.excerpt),
    category: String(row.category), author: String(row.author), publishedAt: String(row.published_at),
    readTime: String(row.read_time), tocTitle: String(row.toc_title ?? "ON THIS PAGE"),
    tags: JSON.parse(String(row.tags)), blocks: JSON.parse(String(row.blocks)),
  };
}

export async function GET(request: NextRequest) {
  const db = await ensureDatabase();
  const slug = request.nextUrl.searchParams.get("slug");
  if (slug) {
    const row = await db.prepare("SELECT * FROM posts WHERE slug = ?").bind(slug).first<Record<string, unknown>>();
    if (!row) return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(rowToPost(row));
  }

  const requestedPage = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(10, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 1) || 1));
  const category = (request.nextUrl.searchParams.get("category") ?? "").trim();
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const like = `%${query}%`;
  const where = `WHERE (? = '' OR category = ?) AND
    (? = '' OR title LIKE ? OR excerpt LIKE ? OR tags LIKE ? OR blocks LIKE ?)`;
  const bindings = [category, category, query, like, like, like, like];
  const countRow = await db.prepare(`SELECT COUNT(*) AS count FROM posts ${where}`).bind(...bindings).first<{ count: number }>();
  const totalItems = Number(countRow?.count ?? 0);
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;
  const rows = await db.prepare(`SELECT * FROM posts ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
    .bind(...bindings, pageSize, offset).all<Record<string, unknown>>();

  return NextResponse.json({
    items: rows.results.map(rowToPost),
    pagination: { page, pageSize, totalItems, totalPages, hasPrevious: page > 1, hasNext: totalPages > 0 && page < totalPages },
  });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminUser())) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 });
  const db = await ensureDatabase();
  const body = await request.json().catch(() => ({})) as { category?: string; title?: string };
  const id = crypto.randomUUID();
  const now = new Date();
  const post: Post = {
    id,
    slug: `content-${Date.now()}-${id.slice(0, 6)}`,
    title: body.title?.trim() || "새 AI 콘텐츠",
    excerpt: "콘텐츠 요약을 입력하세요.",
    category: body.category?.trim() || "업무 자동화",
    author: "AI CoE",
    publishedAt: new Intl.DateTimeFormat("ko-KR").format(now),
    readTime: "5분",
    tocTitle: "ON THIS PAGE",
    tags: ["AI CoE"],
    blocks: [
      { id: `heading-${Date.now()}`, type: "heading", text: "새 섹션" },
      { id: `paragraph-${Date.now()}`, type: "paragraph", text: "여기에 내용을 입력하세요." },
    ],
  };
  await db.prepare(`INSERT INTO posts
    (id, slug, title, excerpt, category, author, published_at, read_time, toc_title, tags, blocks, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(post.id, post.slug, post.title, post.excerpt, post.category, post.author, post.publishedAt,
      post.readTime, post.tocTitle, JSON.stringify(post.tags), JSON.stringify(post.blocks), now.toISOString())
    .run();
  return NextResponse.json(post, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminUser())) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 });
  const db = await ensureDatabase();
  const post = (await request.json()) as Post;
  if (!post?.id || !post?.slug || !post?.title || !Array.isArray(post.blocks)) {
    return NextResponse.json({ error: "저장할 게시물 형식이 올바르지 않습니다." }, { status: 400 });
  }
  await db.prepare(`UPDATE posts SET title = ?, excerpt = ?, category = ?, author = ?, published_at = ?,
    read_time = ?, toc_title = ?, tags = ?, blocks = ?, updated_at = ? WHERE id = ?`)
    .bind(post.title, post.excerpt, post.category, post.author, post.publishedAt, post.readTime, post.tocTitle,
      JSON.stringify(post.tags), JSON.stringify(post.blocks), new Date().toISOString(), post.id)
    .run();
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
