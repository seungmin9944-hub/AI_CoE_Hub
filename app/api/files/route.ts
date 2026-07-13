import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "../../admin-auth";

type RuntimeEnv = { FILES?: R2Bucket };

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function safeFileName(name: string, type: string) {
  const extension = name.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0]
    ?? (type.startsWith("image/") ? `.${type.split("/")[1]?.replace("jpeg", "jpg") || "png"}` : "");
  const stem = name.replace(/\.[^.]+$/, "").normalize("NFKC").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${stem || "file"}-${crypto.randomUUID().slice(0, 8)}${extension.toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  if (!(await isAdminUser())) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 });
  const bucket = (env as unknown as RuntimeEnv).FILES;
  if (!bucket) return NextResponse.json({ error: "파일 저장소 연결을 확인해 주세요." }, { status: 503 });

  try {
    const requestType = request.headers.get("content-type") || "application/octet-stream";
    let originalName = "upload";
    let contentType = requestType;
    let bytes: ArrayBuffer;

    if (requestType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
      originalName = file.name || originalName;
      contentType = file.type || "application/octet-stream";
      bytes = await file.arrayBuffer();
    } else {
      const encodedName = request.headers.get("x-ai-coe-file-name");
      if (encodedName) {
        try {
          originalName = decodeURIComponent(encodedName);
        } catch {
          originalName = encodedName;
        }
      }
      bytes = await request.arrayBuffer();
    }

    if (bytes.byteLength > MAX_FILE_SIZE) return NextResponse.json({ error: "파일은 50MB 이하만 업로드할 수 있습니다." }, { status: 413 });
    if (!bytes.byteLength) return NextResponse.json({ error: "빈 파일은 업로드할 수 없습니다." }, { status: 400 });

    const safeName = safeFileName(originalName, contentType);
    const key = `uploads/${Date.now()}-${safeName}`;
    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType,
        contentDisposition: `${contentType.startsWith("image/") ? "inline" : "attachment"}; filename=\"${safeName}\"`,
      },
      customMetadata: { originalName },
    });
    return NextResponse.json({ url: `/api/files/${key}`, name: originalName, size: bytes.byteLength });
  } catch (error) {
    console.error("R2 upload failed", error);
    return NextResponse.json({ error: "파일 저장소 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
