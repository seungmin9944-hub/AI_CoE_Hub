import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the AI CoE knowledge hub and backend routes", async () => {
  const [client, content, postsApi, filesApi, uploadApi, adminAuth, adminPage, adminProxy, hosting] = await Promise.all([
    readFile(new URL("../app/AICoeHub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/content.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/posts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/files/[...key]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/files/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../cloudflare/admin-proxy-worker.js", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  await access(new URL("../dist/server/index.js", import.meta.url));
  assert.match(client, /관리자 모드/);
  assert.match(client, /Ctrl\/⌘ \+ V 이미지 붙여넣기/);
  assert.match(client, /clipboardImage/);
  assert.match(client, /image-size-control/);
  assert.match(client, /행 추가/);
  assert.match(client, /열 추가/);
  assert.match(client, /PDF, PPT, PNG, XLSX/);
  assert.match(client, /ideaMailto/);
  assert.match(client, /pagination\.hasPrevious/);
  assert.match(client, /drag-handle/);
  assert.match(client, /목차와 본문 제목 추가/);
  assert.match(client, /activeHeadingId/);
  assert.match(client, /inline-slash-menu/);
  assert.match(client, /adminPortalUrl/);
  assert.doesNotMatch(client, /실습 가이드/);
  assert.match(client, /navigator\.clipboard\.writeText/);
  assert.match(content, /엑셀 보고서의 종말 선언/);
  assert.match(content, /category: "업무 자동화"/);
  assert.match(postsApi, /CREATE TABLE IF NOT EXISTS posts/);
  assert.match(postsApi, /totalPages/);
  assert.match(postsApi, /export async function POST/);
  assert.match(postsApi, /관리자 권한이 필요합니다/);
  assert.match(filesApi, /bucket\.put/);
  assert.match(uploadApi, /isAdminUser/);
  assert.match(adminAuth, /cf-access-jwt-assertion/);
  assert.match(adminAuth, /RSASSA-PKCS1-v1_5/);
  assert.match(adminAuth, /ADMIN_EMAILS/);
  assert.match(adminPage, /한화이센셜 AI CoE 관리자 로그인/);
  assert.match(adminPage, /redirect\(adminPortalUrl\)/);
  assert.match(adminProxy, /SITE_ORIGIN/);
  assert.match(adminProxy, /x-ai-coe-access-token/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "FILES"/);
});
