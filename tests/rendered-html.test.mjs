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
  assert.match(client, /슬래시 명령 입력/);
  assert.match(client, /navigator\.clipboard\.writeText/);
  assert.match(content, /엑셀 보고서의 종말 선언/);
  assert.match(postsApi, /CREATE TABLE IF NOT EXISTS posts/);
  assert.match(filesApi, /bucket\.put/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "FILES"/);
});
