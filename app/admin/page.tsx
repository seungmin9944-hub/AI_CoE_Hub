import { AICoeHub } from "../AICoeHub";
import { getAdminUser } from "../admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (admin) return <AICoeHub initialAdmin adminPortalUrl="/admin" />;

  return <main className="admin-gate">
    <section className="admin-gate-card">
      <div className="cloudflare-mark"><span>☁</span>Cloudflare Access</div>
      <h1>관리자 전용 주소입니다</h1>
      <p>허용된 관리자 이메일로 Cloudflare Access 인증을 완료한 뒤 이 주소에 접속할 수 있습니다.</p>
      <div className="admin-gate-status"><span>보호됨</span>인증 토큰이 없거나 허용된 관리자 계정이 아닙니다.</div>
      <a href="/">← 일반 사이트로 돌아가기</a>
    </section>
  </main>;
}
