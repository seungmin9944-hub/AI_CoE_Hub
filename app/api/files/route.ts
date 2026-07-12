import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

type RuntimeEnv = { FILES: R2Bucket };

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "파일은 10MB 이하만 업로드할 수 있습니다." }, { status: 413 });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const key = `uploads/${Date.now()}-${safeName}`;
  await (env as unknown as RuntimeEnv).FILES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream", contentDisposition: `inline; filename=\"${safeName}\"` },
    customMetadata: { originalName: file.name },
  });
  return NextResponse.json({ url: `/api/files/${key}`, name: file.name, size: file.size });
}
