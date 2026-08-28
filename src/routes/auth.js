import {
  OIDC_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  base64UrlEncode,
  buildCookie,
  createSignedCookieValue,
  parseCookies,
  readSignedCookieValue,
} from "../lib/cookies.js";
import { redirectResponse } from "../lib/response.js";
import {
  decodeJwtPayload,
  getOidcConfig,
  normalizeOidcUser,
} from "../lib/auth.js";

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(digest));
}

function getRedirectUri(request) {
  return `${new URL(request.url).origin}/auth/callback`;
}

export async function handleAuthLogin(request, env) {
  const config = await getOidcConfig(env);
  const url = new URL(request.url);
  const state = randomToken();
  const verifier = randomToken();
  const challenge = await sha256Base64Url(verifier);
  const rd = url.searchParams.get("rd") || "/";
  const oidcCookie = await createSignedCookieValue(env.SESSION_SECRET, {
    state,
    verifier,
    rd,
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  });
  const authUrl = new URL(config.authorization_endpoint);
  authUrl.searchParams.set("client_id", env.AUTHENTIK_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", getRedirectUri(request));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email groups");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  return redirectResponse(authUrl.toString(), {
    "set-cookie": buildCookie(OIDC_COOKIE_NAME, oidcCookie, { maxAge: 10 * 60 }),
  });
}

async function fetchOidcUserClaims(config, tokenSet) {
  let claims = tokenSet.id_token ? decodeJwtPayload(tokenSet.id_token) || {} : {};
  if (config.userinfo_endpoint && tokenSet.access_token) {
    const response = await fetch(config.userinfo_endpoint, {
      headers: { authorization: `Bearer ${tokenSet.access_token}` },
    });
    if (response.ok) {
      claims = { ...claims, ...(await response.json()) };
    }
  }
  return claims;
}

export async function handleAuthCallback(request, env) {
  const url = new URL(request.url);
  const cookies = parseCookies(request);
  const oidcState = await readSignedCookieValue(env.SESSION_SECRET, cookies[OIDC_COOKIE_NAME]);
  if (!oidcState || oidcState.exp < Math.floor(Date.now() / 1000) || oidcState.state !== url.searchParams.get("state")) {
    return new Response("Invalid login state", { status: 400 });
  }
  const code = url.searchParams.get("code");
  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  const config = await getOidcConfig(env);
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", env.AUTHENTIK_CLIENT_ID);
  body.set("client_secret", env.AUTHENTIK_CLIENT_SECRET);
  body.set("code", code);
  body.set("redirect_uri", getRedirectUri(request));
  body.set("code_verifier", oidcState.verifier);

  const tokenResponse = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenResponse.ok) {
    return new Response("Token exchange failed", { status: 502 });
  }

  const tokenSet = await tokenResponse.json();
  const claims = await fetchOidcUserClaims(config, tokenSet);
  const user = normalizeOidcUser(claims);
  const session = await createSignedCookieValue(env.SESSION_SECRET, {
    user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });

  const response = redirectResponse(oidcState.rd || "/");
  response.headers.append("set-cookie", buildCookie(SESSION_COOKIE_NAME, session, { maxAge: SESSION_TTL_SECONDS }));
  response.headers.append("set-cookie", buildCookie(OIDC_COOKIE_NAME, "", { maxAge: 0 }));
  return response;
}

export function handleAuthLogout() {
  return redirectResponse("/", {
    "set-cookie": buildCookie(SESSION_COOKIE_NAME, "", { maxAge: 0 }),
  });
}
