const SITE_ORIGIN = "https://hanwha-essential-ai-coe.reppy1182952347.chatgpt.site";

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.pathname === "/") return Response.redirect(new URL("/admin", incoming), 302);

    const target = new URL(`${incoming.pathname}${incoming.search}`, SITE_ORIGIN);
    const headers = new Headers(request.headers);
    const accessToken = request.headers.get("cf-access-jwt-assertion");
    const accessEmail = request.headers.get("cf-access-authenticated-user-email");
    if (accessToken) headers.set("x-ai-coe-access-token", accessToken);
    if (accessEmail && env.ADMIN_PROXY_SHARED_SECRET) {
      headers.set("x-ai-coe-access-email", accessEmail);
      headers.set("x-ai-coe-proxy-secret", env.ADMIN_PROXY_SHARED_SECRET);
    }
    headers.set("x-forwarded-host", incoming.host);
    headers.set("x-forwarded-proto", "https");

    return fetch(new Request(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    }));
  },
};
