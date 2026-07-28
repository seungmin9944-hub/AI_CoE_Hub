import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "../../admin-auth";
import { storeUpload } from "../../file-storage";

type RuntimeEnv = { FILES?: R2Bucket };

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

    const stored = await storeUpload(bucket, bytes, originalName, contentType);
    return NextResponse.json({ url: stored.url, name: stored.name, size: stored.size });
  } catch (error) {
    if (error instanceof Error && error.message === "FILE_TOO_LARGE") return NextResponse.json({ error: "파일은 50MB 이하만 업로드할 수 있습니다." }, { status: 413 });
    if (error instanceof Error && error.message === "EMPTY_FILE") return NextResponse.json({ error: "빈 파일은 업로드할 수 없습니다." }, { status: 400 });
    console.error("R2 upload failed", error);
    return NextResponse.json({ error: "파일 저장소 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
