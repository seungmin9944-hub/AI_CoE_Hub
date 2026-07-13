import { AICoeHub } from "./AICoeHub";
import { env } from "cloudflare:workers";

type RuntimeEnv = { ADMIN_PORTAL_URL?: string };

export default function Home() {
  const adminPortalUrl = (env as unknown as RuntimeEnv).ADMIN_PORTAL_URL?.trim() || "/admin";
  return <AICoeHub adminPortalUrl={adminPortalUrl} />;
}
