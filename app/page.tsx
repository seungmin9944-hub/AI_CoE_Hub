import { AICoeHub } from "./AICoeHub";
import { isAdminUser } from "./admin-auth";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const adminAuthorized = user ? await isAdminUser() : false;
  return <AICoeHub adminAuthorized={adminAuthorized} signedIn={Boolean(user)} signInPath={chatGPTSignInPath("/?admin=1")} />;
}
