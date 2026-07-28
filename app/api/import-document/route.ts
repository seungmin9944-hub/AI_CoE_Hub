import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "../../admin-auth";
import { importDocument } from "../../document-import";
import { storeUpload } from "../../file-storage";

type RuntimeEnv = { FILES?: R2Bucket };
const MAX_IMPORT_SIZE = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (!(await isAdminUser())) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 401 });
  const bucket = (env as unknown as RuntimeEnv).FILES;
  if (!bucket) return NextResponse.json({ error: "파일 저장소 연결을 확인해 주세요." }, { status: 503 });

  const encodedName = request.headers.get("x-ai-coe-file-name") || "document";
  let name = encodedName;
  try { name = decodeURIComponent(encodedName); } catch { name = encodedName; }
  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return NextResponse.json({ error: "빈 문서는 가져올 수 없습니다." }, { status: 400 });
  if (bytes.byteLength > MAX_IMPORT_SIZE) return NextResponse.json({ error: "콘텐츠 변환은 25MB 이하 문서만 지원합니다." }, { status: 413 });

  try {
    const imported = await importDocument(bytes.slice(0), name, contentType);
    const stored = await storeUpload(bucket, bytes, name, contentType);
    return NextResponse.json({
      ...imported,
      attachment: { id: `attachment-${crypto.randomUUID()}`, type: "attachment", name, url: stored.url, size: stored.size },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNSUPPORTED_DOCUMENT") return NextResponse.json({ error: "DOCX, PPTX, PDF 파일만 콘텐츠로 변환할 수 있습니다." }, { status: 415 });
    if (error instanceof Error && error.message === "EMPTY_DOCUMENT") return NextResponse.json({ error: "문서에서 변환할 텍스트를 찾지 못했습니다. 스캔 PDF는 텍스트 PDF로 변환해 주세요." }, { status: 422 });
    console.error("Document import failed", error);
    return NextResponse.json({ error: "문서 변환에 실패했습니다. 파일이 손상되지 않았는지 확인해 주세요." }, { status: 500 });
  }
}
