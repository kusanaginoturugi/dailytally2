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
    let url = new URL(request.url);

    if (isOidcConfigured(env)) {
      if (url.pathname === "/auth/login") return handleAuthLogin(request, env);
      if (url.pathname === "/auth/callback") return handleAuthCallback(request, env);
      if (url.pathname === "/auth/logout") return handleAuthLogout();
    }

    const auth = await authenticateRequest(request, env);
    if (auth.response) return auth.response;
    request = auth.request;
    url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runScheduledReport(env));
  },
};
