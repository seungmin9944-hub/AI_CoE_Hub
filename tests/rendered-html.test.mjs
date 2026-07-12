import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the AI CoE knowledge hub and backend routes", async () => {
  const [client, content, postsApi, filesApi, hosting] = await Promise.all([
    readFile(new URL("../app/AICoeHub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/content.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/posts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/files/[...key]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  await access(new URL("../dist/server/index.js", import.meta.url));
  assert.match(client, /관리자 모드/);
  assert.match(client, /첨부파일을 추가할 수 있습니다/);
  assert.match(client, /PDF, PPT, PNG, XLSX/);
  assert.match(client, /ideaMailto/);
  assert.doesNotMatch(client, /실습 가이드/);
  assert.match(client, /navigator\.clipboard\.writeText/);
  assert.match(content, /엑셀 보고서의 종말 선언/);
  assert.match(content, /category: "업무 자동화"/);
  assert.match(postsApi, /CREATE TABLE IF NOT EXISTS posts/);
  assert.match(filesApi, /bucket\.put/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "FILES"/);
});
