import { AICoeHub } from "../AICoeHub";
import { getAdminUser } from "../admin-auth";
import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type RuntimeEnv = { ADMIN_PORTAL_URL?: string };

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (admin) return <AICoeHub initialAdmin adminPortalUrl="/admin" />;

  const adminPortalUrl = ((env as unknown as RuntimeEnv).ADMIN_PORTAL_URL?.trim() || "/admin").replace(/\/$/, "");
  if (adminPortalUrl.startsWith("https://")) redirect(adminPortalUrl);

  return <main className="admin-gate">
    <section className="admin-gate-card">
      <div className="cloudflare-mark"><span>☁</span>Cloudflare Access</div>
      <h1>한화이센셜 AI CoE 관리자 로그인</h1>
      <p>관리자 로그인 주소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <a className="admin-back-link" href="/">← 일반 사이트로 돌아가기</a>
    </section>
  </main>;
}
