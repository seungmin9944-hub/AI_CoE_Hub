export type TextBlock = {
  id: string;
  type: "paragraph" | "heading" | "callout" | "code";
  text: string;
  language?: string;
  tone?: "info" | "warning" | "success";
};

export type TableBlock = {
  id: string;
  type: "table";
  rows: string[][];
};

export type ImageBlock = {
  id: string;
  type: "image";
  url: string;
  caption: string;
};

export type AttachmentBlock = {
  id: string;
  type: "attachment";
  name: string;
  url: string;
  size: string;
};

export type ContentBlock = TextBlock | TableBlock | ImageBlock | AttachmentBlock;

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishedAt: string;
  readTime: string;
  tags: string[];
  blocks: ContentBlock[];
};

export const seedPost: Post = {
  id: "cloudflare-dashboard-01",
  slug: "excel-cloudflare-dashboard",
  title: "엑셀 보고서의 종말 선언! 100% 무료, 실시간 웹 대시보드 만들기 (w CloudFlare)",
  excerpt: "엑셀 데이터를 인터랙티브 대시보드로 만들고 Cloudflare R2와 Workers에 배포하는 전 과정을 따라 해봅니다.",
  category: "실습 가이드",
  author: "AI CoE",
  publishedAt: "2026. 7. 12.",
  readTime: "18분",
  tags: ["Cloudflare", "Excel", "Dashboard", "R2"],
  blocks: [
    { id: "b01", type: "callout", tone: "warning", text: "▶️ 유튜브 영상 바로가기\n이 글과 함께 영상을 보며 순서대로 실습해 보세요." },
    { id: "b02", type: "heading", text: "📂 실습파일 다운로드" },
    { id: "b03", type: "attachment", name: "라이브 268회 엑셀 x 클라우드플레어 인터랙티브 대시보드.zip", url: "/api/files/live-268-cloudflare-dashboard.zip", size: "2 KB" },
    { id: "b04", type: "attachment", name: "index.html", url: "/api/files/index.html", size: "211 B" },
    { id: "b05", type: "heading", text: "[1] 엑셀 데이터 → 인터랙티브 대시보드 제작하기" },
    { id: "b06", type: "heading", text: "1️⃣ 대시보드 구성요소 / 레이아웃 기획" },
    { id: "b07", type: "code", language: "prompt", text: "# 역할\n당신은 데이터를 분석하고 시각화 대시보드를 설계하는 프론트엔드 전문가입니다.\n\n# 목표\n위에 주어진 판매 데이터를 바탕으로, 대시보드를 만들기 전에 필요한 '구성 요소'와 '레이아웃'을 먼저 제안하세요.\n- 사용 대상: 삼성그룹 임직원 및 경영진\n- 핵심 목적: 매출·영업이익 현황을 한눈에 파악\n\n# 작업 순서\n1. 이 데이터로 분석 가능한 핵심 관점을 3~5개로 요약\n2. 위 목적에 맞는 KPI 지표 후보 제안 (각 지표의 계산 방식 포함)\n3. 추천 차트 목록 제안 (각 차트가 나타내는 질문 + 차트 유형)\n4. 화면 레이아웃 구성안 제시 (위 → 아래 배치 순서)\n\n# 출력 형식\n- 표 또는 항목별 목록으로 간결하게 정리합니다.\n- 다른 세션에 바로 복사해 사용할 수 있는 md 텍스트로 작성합니다.\n- 경영진이 빠르게 검토할 수 있도록 핵심 위주로 구성합니다.\n\n# 주의사항\n- 지금은 '기획 단계'입니다. 대시보드 제작은 별도 세션에서 진행하겠습니다.\n- HTML 코드는 아직 작성하지 마세요. 구성안을 먼저 제안합니다." },
    { id: "b08", type: "heading", text: "2️⃣ 대시보드 스타일 가이드 만들기" },
    { id: "b09", type: "paragraph", text: "디자인 시스템 참고: https://www.oppadu.com/tools/design-systems-site/" },
    { id: "b10", type: "callout", tone: "info", text: "디자인 시스템 페이지에서 원하는 스타일을 고른 뒤, 컬러·타이포그래피·카드·차트 표현 규칙을 프롬프트에 포함하세요." },
    { id: "b11", type: "heading", text: "3️⃣ 인터랙티브 대시보드 만들기" },
    { id: "b12", type: "code", language: "prompt", text: "# 역할\n당신은 주어진 데이터를 분석하고 HTML 코드로 작성된 시각화 대시보드를 만드는 프론트엔드 전문가입니다.\n\n# 목표\n위에 첨부한 데이터를 분석하는 대시보드(index.html)를 생성합니다.\n- 사용 대상: 삼성그룹 임직원 및 경영진\n- 핵심 목적: 매출·영업이익 현황을 한눈에 파악\n\n# 디자인 시스템\n첨부한 디자인 시스템 md 문서를 참고하세요.\n\n# 데이터 연결 방식\n- 데이터 연결 규칙은 반드시 지켜서 제작하세요.\n- 데이터는 같은 서버의 상대경로 ./data.xlsx를 fetch로 읽습니다. 전체 URL 사용은 금지합니다.\n- SheetJS(xlsx) 라이브러리로 브라우저에서 직접 .xlsx를 파싱합니다.\n- 차트는 Chart.js를 사용합니다.\n\n# 실행 환경 자동 분기\nlocation.protocol을 확인해 http/https와 file 모드로 자동 분기합니다.\n1) http/https: ./data.xlsx에 Date.now() 캐시 무효화 값을 붙이고 cache: 'no-store'로 fetch합니다.\n2) file: 보안 정책상 fetch가 동작하지 않으므로 파일 선택과 드래그&드롭으로 data.xlsx를 직접 불러옵니다." },
    { id: "b13", type: "heading", text: "[2] 인터랙티브 대시보드 → 웹에 띄우기" },
    { id: "b14", type: "paragraph", text: "Cloudflare 계정 생성: https://www.cloudflare.com/" },
    { id: "b15", type: "callout", tone: "success", text: "👉 계정 생성 및 R2/Worker 생성 전체 과정은 라이브에서 알아봅니다. AWS S3와 비슷한 서비스지만 전송 요금이 0원이며, 무료 티어로 시작할 수 있습니다." },
    { id: "b16", type: "table", rows: [["구분", "무료 제공 한도"], ["저장 용량", "10GB"], ["업로드 횟수 (Class A)", "월 100만 회"], ["조회 횟수 (Class B)", "월 1,000만 회"], ["전송량", "무제한"]] },
    { id: "b17", type: "heading", text: "2-4] 대시보드 워커(실행 서버) 만들기" },
    { id: "b18", type: "code", language: "javascript", text: "export default {\n  async fetch(request, env) {\n    const url = new URL(request.url);\n    const key = url.pathname === \"/\" ? \"index.html\" : url.pathname.slice(1);\n\n    const obj = await env.BUCKET.get(key);\n    if (!obj) return new Response(\"Not found\", { status: 404 });\n\n    const headers = new Headers();\n    if (key.endsWith(\".html\")) {\n      headers.set(\"Content-Type\", \"text/html; charset=utf-8\");\n    } else if (key.endsWith(\".xlsx\")) {\n      headers.set(\"Content-Type\", \"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\");\n    }\n    headers.set(\"Cache-Control\", \"no-store\");\n    return new Response(obj.body, { headers });\n  }\n};" },
    { id: "b19", type: "heading", text: "2-5] R2 퍼블릭 도메인 비활성화 · 2-6] 로그인 기능 적용" },
    { id: "b20", type: "callout", tone: "info", text: "퍼블릭 R2 도메인은 비활성화하고 Cloudflare Access를 적용하세요. 기업용 커스텀 로그인 페이지에는 회사 로고, 안내문, 관리자 문의처를 함께 표시합니다." },
    { id: "b21", type: "heading", text: "[3] 엑셀 → 서버 업로드 자동화 워커 만들기" },
    { id: "b22", type: "code", language: "javascript", text: "export default {\n  async fetch(request, env) {\n    if (request.method !== \"POST\")\n      return new Response(\"POST only\", { status: 405 });\n    if (request.headers.get(\"x-secret\") !== env.UPLOAD_SECRET)\n      return new Response(\"Unauthorized\", { status: 401 });\n    await env.BUCKET.put(\"data.xlsx\", request.body);\n    return new Response(\"OK\");\n  }\n};" },
    { id: "b23", type: "code", language: "vba", text: "Public MyRibbon As IRibbonUI\n\n'========== 여기만 수정하세요! ==========\nConst WORKER_URL As String = \"https://xxxx.workers.dev/\"\nConst SECRET As String = \"xxxxxxxx\"\nConst SOURCE_SHEET As String = \"Sheet1\"\n'======================================\n\nSub btn_R2_Upload(control As IRibbonControl)\n    UploadToR2\nEnd Sub\n\nSub UploadToR2()\n    Dim srcWs As Worksheet\n    On Error Resume Next\n    Set srcWs = ThisWorkbook.Worksheets(SOURCE_SHEET)\n    On Error GoTo 0\n    If srcWs Is Nothing Then\n        MsgBox SOURCE_SHEET & \" 시트를 찾을 수 없습니다.\", vbExclamation\n        Exit Sub\n    End If\n\n    ' 값을 임시 파일로 저장한 뒤 바이트로 읽어 Worker에 전송합니다.\n    ' 헤더: x-secret / Content-Type: application/octet-stream\n    ' 성공 시 사용자에게 서버 갱신 완료 메시지를 표시합니다.\nEnd Sub" },
    { id: "b24", type: "heading", text: "[4] 클라우드플레어 R2 결제 전 알림 설정하기" },
    { id: "b25", type: "paragraph", text: "1. Cloudflare 계정 페이지 왼쪽 아래 Manage account로 이동합니다.\n2. Billing 화면에서 현재 무료 티어(Zero Trust, R2 Storage)를 확인합니다.\n3. Usage 영역의 Add Budget Alert를 클릭합니다.\n4. 초과 예산 기준을 $0.01로 입력하고 관리자 이메일을 등록한 뒤 저장합니다.\n5. Notifications 탭에서 알림 목록과 활성 상태를 확인합니다." },
    { id: "b26", type: "callout", tone: "warning", text: "무료 티어 한도를 초과해 결제가 되기 전에 관리자 메일로 알림을 받을 수 있도록 $0.01 예산 알림을 꼭 설정하세요." }
  ]
};
