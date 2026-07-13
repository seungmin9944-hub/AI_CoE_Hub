import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "../../admin-auth";

type RuntimeEnv = { FILES?: R2Bucket };

function safeFileName(name: string, type: string) {
  const extension = name.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0]
    ?? (type.startsWith("image/") ? `.${type.split("/")[1]?.replace("jpeg", "jpg") || "png"}` : "");
  const stem = name.replace(/\.[^.]+$/, "").normalize("NFKC").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${stem || "file"}-${crypto.randomUUID().slice(0, 8)}${extension.toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  if (!(await isAdminUser())) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "파일은 50MB 이하만 업로드할 수 있습니다." }, { status: 413 });
  if (!file.size) return NextResponse.json({ error: "빈 파일은 업로드할 수 없습니다." }, { status: 400 });
  const bucket = (env as unknown as RuntimeEnv).FILES;
  if (!bucket) return NextResponse.json({ error: "파일 저장소 연결을 확인해 주세요." }, { status: 503 });
  const safeName = safeFileName(file.name || "upload", file.type);
  const key = `uploads/${Date.now()}-${safeName}`;
  try {
    const bytes = await file.arrayBuffer();
    const contentType = file.type || "application/octet-stream";
    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType,
        contentDisposition: `${contentType.startsWith("image/") ? "inline" : "attachment"}; filename=\"${safeName}\"`,
      },
      customMetadata: { originalName: file.name || safeName },
    });
    return NextResponse.json({ url: `/api/files/${key}`, name: file.name || safeName, size: file.size });
  } catch (error) {
    console.error("R2 upload failed", error);
    return NextResponse.json({ error: "파일 저장소 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
