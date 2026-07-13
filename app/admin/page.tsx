import { AICoeHub } from "../AICoeHub";
import { getAdminUser } from "../admin-auth";
import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

type RuntimeEnv = { ADMIN_PORTAL_URL?: string };

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (admin) return <AICoeHub initialAdmin adminPortalUrl="/admin" />;

  const adminPortalUrl = ((env as unknown as RuntimeEnv).ADMIN_PORTAL_URL?.trim() || "/admin").replace(/\/$/, "");
  const logoutUrl = adminPortalUrl.startsWith("https://") ? `${adminPortalUrl}/cdn-cgi/access/logout` : adminPortalUrl;

  return <main className="admin-gate">
    <section className="admin-gate-card">
      <div className="cloudflare-mark"><span>☁</span>Cloudflare Access</div>
      <h1>한화이센셜 AI CoE 관리자 로그인</h1>
      <p>등록된 관리자 이메일로 Cloudflare Access 인증을 진행해 주세요. 인증이 완료되면 콘텐츠 편집 화면으로 이동합니다.</p>
      <a className="admin-login-button" href={adminPortalUrl}>Cloudflare로 로그인</a>
      <div className="admin-login-help"><span>로그인 안내</span><p>이전 인증 정보가 남아 있거나 다른 계정으로 로그인하려면 먼저 세션을 초기화해 주세요.</p><a href={logoutUrl}>다른 계정으로 다시 로그인</a></div>
      <a className="admin-back-link" href="/">← 일반 사이트로 돌아가기</a>
    </section>
  </main>;
}
