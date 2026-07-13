import { getChatGPTUser } from "./chatgpt-auth";

const ADMIN_EMAILS = new Set([
  "seungmin.kim@hanwha.com",
  "ghcho08@hanwha.com",
  "taewonkim@hanwha.com",
  "semin1000@hanwha.com",
]);

export async function isAdminUser() {
  const user = await getChatGPTUser();
  if (!user) return false;
  return ADMIN_EMAILS.has(user.email.toLowerCase());
}
