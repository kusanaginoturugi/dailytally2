import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  buildCookie,
  createSignedCookieValue,
  parseCookies,
  readSignedCookieValue,
  base64UrlDecode,
} from "./cookies.js";
import { redirectResponse } from "./response.js";

export const FELLOWSHIP_NAMES = ["大江戸", "お台場", "羽田", "かながわ", "富士山", "駿天", "埼玉", "千葉", "山梨"];
const ADMIN_GROUPS = ["admin", "dailytally-admin", "管理者"];

export function isOidcConfigured(env) {
  return Boolean(env.AUTHENTIK_ISSUER && env.AUTHENTIK_CLIENT_ID && env.AUTHENTIK_CLIENT_SECRET && env.SESSION_SECRET);
}

export async function getOidcConfig(env) {
  const issuer = env.AUTHENTIK_ISSUER.replace(/\/+$/, "");
  const response = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new Error(`OIDC discovery returned ${response.status}`);
  }
  return response.json();
}

export function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) {
    return {};
  }
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  } catch (_error) {
    return {};
  }
}

export function normalizeOidcUser(claims) {
  const rawGroups = Array.isArray(claims.groups)
    ? claims.groups
    : Array.isArray(claims.group)
      ? claims.group
      : Array.isArray(claims.ak_groups)
        ? claims.ak_groups
        : typeof claims.groups === "string"
          ? claims.groups.split(/[,\s|]+/)
          : typeof claims.group === "string"
            ? claims.group.split(/[,\s|]+/)
            : typeof claims.ak_groups === "string"
              ? claims.ak_groups.split(/[,\s|]+/)
              : [];
  const groups = rawGroups.map((group) => String(group));
  const fellowship = groups.find((group) => FELLOWSHIP_NAMES.includes(group)) || "";
  const role = groups.some((group) => ADMIN_GROUPS.includes(group)) ? "admin" : "";
  return {
    loginId: claims.preferred_username || claims.nickname || claims.email || claims.sub || "",
    fellowship,
    name: claims.name || claims.preferred_username || "",
    email: claims.email || "",
    role,
  };
}

export function createEmptyUser() {
  return { loginId: "", fellowship: "", name: "", email: "", role: "" };
}

function readSSOHeader(request, name) {
  const value = request.headers.get(name);
  if (!value) {
    return "";
  }
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
}

function parseSSOGroups(value) {
  return String(value || "")
    .split(/[,\s|]+/)
    .map((group) => group.trim())
    .filter(Boolean);
}

export function getCurrentUser(request) {
  const groups = parseSSOGroups(readSSOHeader(request, "x-authentik-groups"));
  const fellowship =
    readSSOHeader(request, "x-dailytally-fellowship") ||
    groups.find((group) => FELLOWSHIP_NAMES.includes(group)) ||
    "";
  const role =
    readSSOHeader(request, "x-dailytally-role") ||
    (groups.some((group) => ADMIN_GROUPS.includes(group)) ? "admin" : "");
  const email =
    readSSOHeader(request, "x-dailytally-email") ||
    readSSOHeader(request, "x-authentik-email") ||
    readSSOHeader(request, "cf-access-authenticated-user-email");
  const user = {
    loginId: readSSOHeader(request, "x-dailytally-login-id") || readSSOHeader(request, "x-authentik-username") || email,
    fellowship,
    name: readSSOHeader(request, "x-dailytally-name") || readSSOHeader(request, "x-authentik-name"),
    email,
    role,
  };
  return hasUserIdentity(user) ? user : createEmptyUser();
}

export function hasUserIdentity(user) {
  return ["loginId", "fellowship", "name", "email", "role"].some((key) => String(user?.[key] || "").trim() !== "");
}

export function canWriteFellowship(request, fellowshipName) {
  const user = getCurrentUser(request);
  if (!hasUserIdentity(user)) {
    return true;
  }
  return user.role === "admin" || user.fellowship === fellowshipName;
}

export function canWriteAdmin(request) {
  const user = getCurrentUser(request);
  if (!hasUserIdentity(user)) {
    return true;
  }
  return user.role === "admin";
}

export async function readSession(request, env) {
  const session = await readSignedCookieValue(env.SESSION_SECRET, parseCookies(request)[SESSION_COOKIE_NAME]);
  if (!session || session.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  if (isOidcConfigured(env) && !session.accessToken) {
    return null;
  }
  return session;
}

export async function readSessionUser(request, env) {
  const session = await readSession(request, env);
  return session?.user || null;
}

export async function refreshSessionUser(request, env) {
  const session = await readSession(request, env);
  if (!session) {
    return null;
  }
  if (!isOidcConfigured(env) || !session.accessToken) {
    return { user: session.user || null };
  }
  try {
    const config = await getOidcConfig(env);
    if (!config.userinfo_endpoint) {
      return { user: session.user || null };
    }
    const response = await fetch(config.userinfo_endpoint, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    if (!response.ok) {
      return { user: session.user || null };
    }
    const user = normalizeOidcUser(await response.json());
    const updatedSession = await createSignedCookieValue(env.SESSION_SECRET, {
      ...session,
      user,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    });
    return {
      user,
      cookie: buildCookie(SESSION_COOKIE_NAME, updatedSession, { maxAge: SESSION_TTL_SECONDS }),
    };
  } catch (_error) {
    return { user: session.user || null };
  }
}

function requestWithUserHeaders(request, user) {
  const headers = new Headers(request.headers);
  const encode = (value) => encodeURIComponent(String(value || ""));
  headers.set("x-dailytally-login-id", encode(user.loginId));
  headers.set("x-dailytally-fellowship", encode(user.fellowship));
  headers.set("x-dailytally-name", encode(user.name));
  headers.set("x-dailytally-email", encode(user.email));
  headers.set("x-dailytally-role", encode(user.role));
  return new Request(request, { headers });
}

export async function authenticateRequest(request, env) {
  if (!isOidcConfigured(env)) {
    return { request };
  }
  const url = new URL(request.url);
  if (url.pathname.startsWith("/auth/")) {
    return { request };
  }
  const user = await readSessionUser(request, env);
  if (!user) {
    const loginUrl = new URL("/auth/login", url.origin);
    loginUrl.searchParams.set("rd", `${url.pathname}${url.search}`);
    return { response: redirectResponse(loginUrl.toString()) };
  }
  return { request: requestWithUserHeaders(request, user), user };
}
