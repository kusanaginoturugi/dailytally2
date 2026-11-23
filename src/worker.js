import { authenticateRequest, isOidcConfigured } from "./lib/auth.js";
import { handleApi } from "./routes/api.js";
import {
  handleAuthCallback,
  handleAuthLogin,
  handleAuthLogout,
} from "./routes/auth.js";
import { runScheduledReport } from "./services/report-sender.js";

export default {
  async fetch(request, env) {
    if (!isOidcConfigured(env)) {
      return new Response("Authentication is not configured", { status: 503 });
    }
    let url = new URL(request.url);

    if (url.pathname === "/auth/login") return handleAuthLogin(request, env);
    if (url.pathname === "/auth/callback") return handleAuthCallback(request, env);
    if (url.pathname === "/auth/logout") return handleAuthLogout();

    const auth = await authenticateRequest(request, env);
    if (auth.response) return auth.response;
    request = auth.request;
    url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }
    const response = await env.ASSETS.fetch(request);
    if (url.pathname === "/" || url.pathname.endsWith(".html")) {
      const headers = new Headers(response.headers);
      headers.set("cache-control", "no-store");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    return response;
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      runScheduledReport(env).catch((error) => {
        console.error("scheduled report failed:", error?.message || error);
      }),
    );
  },
};
