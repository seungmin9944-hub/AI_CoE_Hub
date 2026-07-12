import { env } from "cloudflare:workers";

type RuntimeEnv = { FILES: R2Bucket };

const starterZip = "UEsDBBQAAAAIAPex7FwlR0C/swAAANEAAAAKAAAAaW5kZXguaHRtbLNRTMlPLqksSFXIKMnNsbMBkQo5iXnptkrZ+Up2NrmpJYkKyRmJRcWpJbZKpSVpuhZA0ZLMkpxUO0dPBed8VwWXxOKMpPzEohSFgKLE5JLM5FQbfYgCm6T8lEqgmYZ2rhXJqTlYVQIlbQrsUhJLEvUqcoor3sxsUHg7dcWr3TMUnHPyS1PSchKLUhWCjN5Mn6DwZnrr64VzXk+e83bqjDctO97MmqJno19gZ6MPsUYf7AMAUEsDBBQAAAAIAPex7FwRHvzrtAAAANEAAAAKAAAAUkVBRE1FLnR4dGWOQQqCQBiF957iP8FEdoKQFm27gaBRMCWUgQdQiAwyahJBJckWQQuREVrYhZx/7pBuImj73vvee5LFMjpjwtGt0YthOAbNGgH6Oe4qTANx2yt9AvOlYTpkZi8oJi5gyPHCoamemBXiXoOMGCYvyR7C3wo/J4pKwNBtnTh07bTxoikLaMq3yOIuTnpfs1UA3Ryv7IceENCotTGmVF+ZMFExDNoSr6NPsWQcxCHC9Nhd+Vv+AFBLAQIUAxQAAAAIAPex7FwlR0C/swAAANEAAAAKAAAAAAAAAAAAAACAAQAAAABpbmRleC5odG1sUEsBAhQDFAAAAAgA97HsXBEe/Ou0AAAA0QAAAAoAAAAAAAAAAAAAAIAB2wAAAFJFQURNRS50eHRQSwUGAAAAAAIAAgBwAAAAtwEAAAAA";
const starterHtml = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>AI CoE Dashboard Practice</title><body><h1>Excel Dashboard Practice</h1><p>data.xlsx와 함께 Cloudflare R2에 업로드하세요.</p></body></html>`;

function base64Bytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const bucket = (env as unknown as RuntimeEnv).FILES;
  let object = await bucket.get(key);

  if (!object && key === "live-268-cloudflare-dashboard.zip") {
    await bucket.put(key, base64Bytes(starterZip), { httpMetadata: { contentType: "application/zip", contentDisposition: `attachment; filename="live-268-cloudflare-dashboard.zip"` } });
    object = await bucket.get(key);
  }
  if (!object && key === "index.html") {
    await bucket.put(key, starterHtml, { httpMetadata: { contentType: "text/html; charset=utf-8", contentDisposition: `attachment; filename="index.html"` } });
    object = await bucket.get(key);
  }
  if (!object) return new Response("파일을 찾을 수 없습니다.", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=60");
  return new Response(object.body, { headers });
}
