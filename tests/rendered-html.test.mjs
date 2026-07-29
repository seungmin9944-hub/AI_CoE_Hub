import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the AI CoE knowledge hub and backend routes", async () => {
  const [client, styles, content, postsApi, settingsApi, siteSettings, schema, settingsMigration, coverMigration, uploadApi, fileStorage, importApi, documentImport, adminAuth, adminPage, adminProxy, hosting] = await Promise.all([
    readFile(new URL("../app/AICoeHub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/content.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/posts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/settings/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/site-settings.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_pale_scarlet_spider.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_gorgeous_nextwave.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/files/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/file-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/import-document/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/document-import.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../cloudflare/admin-proxy-worker.js", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  await access(new URL("../dist/server/index.js", import.meta.url));
  assert.match(client, /관리자 모드/);
  assert.match(client, /Ctrl\/⌘ \+ V 이미지/);
  assert.match(client, /clipboardImage/);
  assert.match(client, /clipboardData\.files/);
  assert.match(client, /image-size-control/);
  assert.match(client, /type: "paragraph", text: ""/);
  assert.match(client, /caption: "", width: 100/);
  assert.match(client, /행 추가/);
  assert.match(client, /열 추가/);
  assert.match(client, /<textarea value=\{cell\}/);
  assert.match(client, /cell\.split\("\\n"\)/);
  assert.doesNotMatch(client, /<input value=\{cell\}/);
  assert.match(client, /PDF, PPT, PNG, XLSX/);
  assert.match(client, /ideaMailto/);
  assert.match(client, /pagination\.hasPrevious/);
  assert.match(client, /drag-handle/);
  assert.match(client, /현재 본문 위치에 제목 추가/);
  assert.match(client, /activeHeadingId/);
  assert.match(client, /inline-slash-menu/);
  assert.match(client, /TextFormatMenu/);
  assert.match(client, /URL 링크/);
  assert.match(client, /plainRichText/);
  assert.match(client, /adminPortalUrl/);
  assert.match(client, /nav-title-editor/);
  assert.match(client, /addExploreCategory/);
  assert.match(client, /siteSettings\.categories/);
  assert.match(client, /findTriggerAtCursor/);
  assert.match(client, /text\.slice\(0, safeCursor\)/);
  assert.match(client, /ImageLightbox/);
  assert.match(client, /max="200"/);
  assert.match(client, /ArrowRight/);
  assert.match(client, /ArrowDown/);
  assert.match(client, /event\.key === " "/);
  assert.match(client, /block-rich-editor/);
  assert.match(client, /editorHtmlToRichText/);
  assert.match(client, /커버 이미지 교체/);
  assert.match(client, /normal-mode-button/);
  assert.match(client, /undoHistory/);
  assert.match(client, /length > 20/);
  assert.match(client, /deletePost/);
  assert.match(client, /ideaRecipients\.join\(";%20"\)/);
  assert.match(client, /BookOpen/);
  assert.match(client, /GraduationCap/);
  assert.match(client, /문서로 콘텐츠 만들기/);
  assert.match(client, /\/api\/import-document/);
  assert.match(client, /getBoundingClientRect/);
  assert.match(client, /ResizeObserver/);
  assert.match(client, /tocHidden/);
  assert.match(client, /updateTocMembership/);
  assert.match(client, /목차에서 제거/);
  assert.match(client, /현재 본문 위치에 제목 추가/);
  assert.match(client, /본문 제목 및 목차로 지정/);
  assert.doesNotMatch(client, /백엔드에 저장된 게시물/);
  assert.doesNotMatch(client, /실습 가이드/);
  assert.match(client, /navigator\.clipboard\.writeText/);
  assert.match(styles, /font-size:var\(--paragraph-size,16\.1px\)/);
  assert.match(styles, /td textarea,th textarea/);
  assert.match(styles, /white-space:pre-wrap/);
  assert.match(content, /엑셀 보고서의 종말 선언/);
  assert.match(content, /category: "업무 자동화"/);
  assert.match(content, /textSize\?:/);
  assert.match(content, /tocHidden\?:/);
  assert.match(content, /type: "link"/);
  assert.match(postsApi, /CREATE TABLE IF NOT EXISTS posts/);
  assert.match(postsApi, /totalPages/);
  assert.match(postsApi, /export async function POST/);
  assert.match(postsApi, /export async function DELETE/);
  assert.match(postsApi, /Cache-Control/);
  assert.match(postsApi, /ALTER TABLE posts ADD COLUMN cover/);
  assert.match(postsApi, /관리자 권한이 필요합니다/);
  assert.match(settingsApi, /CREATE TABLE IF NOT EXISTS site_settings/);
  assert.match(settingsApi, /ON CONFLICT\(key\) DO UPDATE/);
  assert.match(settingsApi, /isAdminUser/);
  assert.match(siteSettings, /EXPLORE/);
  assert.match(siteSettings, /defaultCategories/);
  assert.match(siteSettings, /heroTitlePrimary/);
  assert.match(schema, /siteSettings = sqliteTable\("site_settings"/);
  assert.match(schema, /cover: text\("cover"\)/);
  assert.match(settingsMigration, /CREATE TABLE `site_settings`/);
  assert.match(coverMigration, /ALTER TABLE `posts` ADD `cover`/);
  assert.match(fileStorage, /bucket\.put/);
  assert.match(client, /x-ai-coe-file-name/);
  assert.match(client, /body: file/);
  assert.match(uploadApi, /request\.arrayBuffer/);
  assert.match(uploadApi, /multipart\/form-data/);
  assert.match(uploadApi, /R2 upload failed/);
  assert.match(uploadApi, /isAdminUser/);
  assert.match(importApi, /DOCX, PPTX, PDF/);
  assert.match(importApi, /storeUpload/);
  assert.match(importApi, /isAdminUser/);
  assert.match(documentImport, /parseDocx/);
  assert.match(documentImport, /parsePptx/);
  assert.match(documentImport, /extractText/);
  assert.match(adminAuth, /cf-access-jwt-assertion/);
  assert.match(adminAuth, /RSASSA-PKCS1-v1_5/);
  assert.match(adminAuth, /ADMIN_EMAILS/);
  assert.match(adminAuth, /split\(\/\[;,\]\//);
  assert.match(adminAuth, /ADMIN_PROXY_SHARED_SECRET/);
  assert.match(adminAuth, /x-ai-coe-access-email/);
  assert.match(adminPage, /한화이센셜 AI CoE 관리자 로그인/);
  assert.match(adminPage, /redirect\(adminPortalUrl\)/);
  assert.match(adminProxy, /SITE_ORIGIN/);
  assert.match(adminProxy, /x-ai-coe-access-token/);
  assert.match(adminProxy, /x-ai-coe-proxy-secret/);
  assert.match(adminProxy, /request\.body/);
  assert.match(adminProxy, /headers\.delete\("content-length"\)/);
  assert.match(adminProxy, /cache-control/);
  assert.match(adminProxy, /getSetCookie/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "FILES"/);
});
