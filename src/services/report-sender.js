import { formatJSTTimestamp, nowJST } from "../lib/dates.js";
import { mergeCookies, parseCookieHeaders } from "../lib/cookies.js";
import { getActiveCeremonyId, getCeremony, ensureCeremonyDates } from "./ceremonies.js";
import {
  appendReportHistory,
  buildSendKey,
  getReportSettings,
  isReportDue,
  updateReportAttempt,
  updateReportError,
  updateReportSuccess,
} from "./reports.js";
import { generateSummaryPdf } from "./pdf.js";

const TENDO_LOGIN_URL = "https://tendo.net/advanced/login.php?url=/advanced/index.php";
const TENDO_ONLINE_URL = "https://tendo.net/advanced/online.php";
const TENDO_REPORT_FORM_URLS = [
  "https://tendo.net/advanced/online.php",
  "https://tendo.net/advanced/app/activity",
  "https://tendo.net/advanced/app/doumu",
];

async function fetchWithCookies(url, cookie, options = {}) {
  let currentUrl = url;
  let currentCookie = cookie;
  let response = await fetch(currentUrl, {
    ...options,
    headers: { ...(options.headers || {}), cookie: currentCookie },
    redirect: "manual",
  });
  currentCookie = mergeCookies(currentCookie, parseCookieHeaders(response.headers));
  for (let i = 0; i < 5 && response.status >= 300 && response.status < 400; i += 1) {
    const location = response.headers.get("location");
    if (!location) break;
    currentUrl = new URL(location, currentUrl).toString();
    response = await fetch(currentUrl, {
      headers: { cookie: currentCookie },
      redirect: "manual",
    });
    currentCookie = mergeCookies(currentCookie, parseCookieHeaders(response.headers));
  }
  return { response, cookie: currentCookie, url: currentUrl };
}

async function followResponseRedirects(url, response, cookie) {
  let currentUrl = url;
  let currentResponse = response;
  let currentCookie = cookie;
  for (let i = 0; i < 5 && currentResponse.status >= 300 && currentResponse.status < 400; i += 1) {
    const location = currentResponse.headers.get("location");
    if (!location) break;
    currentUrl = new URL(location, currentUrl).toString();
    currentResponse = await fetch(currentUrl, {
      headers: { cookie: currentCookie },
      redirect: "manual",
    });
    currentCookie = mergeCookies(currentCookie, parseCookieHeaders(currentResponse.headers));
  }
  return { response: currentResponse, cookie: currentCookie, url: currentUrl };
}

function extractLoginToken(html) {
  return html.match(/name="token"\s+value="([^"]+)"/)?.[1] || "";
}

function extractReportFormAction(html) {
  const forms = String(html || "").match(/<form\b[\s\S]*?<\/form>/gi) || [];
  const form = forms.find((candidate) =>
    /name=["']up_file\[\]["']|name=["']dendokai["']|name=["']kannondo["']|name=["']mirokuji["']/.test(candidate),
  );
  if (!form) return "";
  return form.match(/\baction=["']([^"']+)["']/i)?.[1] || "";
}

function hasReportFormFields(html) {
  return /name=["']up_file\[\]["']/.test(html) && /name=["']dendokai["']/.test(html);
}

function extractReportIframeUrl(html) {
  const iframes = Array.from(
    String(html || "").matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
  ).map((m) => m[1]);
  return iframes.find((src) => /upload\.php|netvolante|up_file|dendokai/i.test(src)) || "";
}

function summarizeTendoPage(html, url, status) {
  const title = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || "(no title)";
  const names = Array.from(String(html || "").matchAll(/\bname=["']([^"']+)["']/gi)).map((m) => m[1]).slice(0, 12).join(",");
  const actions = Array.from(String(html || "").matchAll(/<form\b[^>]*\baction=["']([^"']*)["'][^>]*>/gi))
    .map((m) => m[1] || "(empty)")
    .slice(0, 6)
    .join(",");
  const iframe = extractReportIframeUrl(html) || "(none)";
  return `status=${status}, url=${url}, title=${title}, names=${names || "(none)"}, actions=${actions || "(none)"}, iframe=${iframe}`;
}

function getTextSnippet(html) {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function summarizeSubmitResult(html, url, status) {
  return `${summarizeTendoPage(html, url, status)}, text=${getTextSnippet(html) || "(none)"}`;
}

function hasTendoSubmitSuccess(html) {
  return /送信(?:しました|完了|されました)|受付(?:しました|完了)|登録(?:しました|完了)|完了しました|ありがとうございました/.test(
    String(html || ""),
  );
}

async function tendoLogin(env) {
  if (!env.TENDO_ACCOUNT || !env.TENDO_PASSWORD) {
    throw new Error("TENDO_ACCOUNT/TENDO_PASSWORD secrets are not configured");
  }
  const loginPage = await fetch(TENDO_LOGIN_URL, { redirect: "follow" });
  const loginHtml = await loginPage.text();
  const token = extractLoginToken(loginHtml);
  const cookie = parseCookieHeaders(loginPage.headers);
  if (!token) {
    throw new Error("Could not find tendo.net login token");
  }
  const body = new URLSearchParams();
  body.set("ses_user", env.TENDO_ACCOUNT);
  body.set("ses_password", env.TENDO_PASSWORD);
  body.set("url", "/advanced/index.php");
  body.set("token", token);
  body.set("ses_login", "ログイン");

  const response = await fetch(TENDO_LOGIN_URL, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie,
      referer: TENDO_LOGIN_URL,
    },
    body,
  });
  const followed = await followResponseRedirects(
    TENDO_LOGIN_URL,
    response,
    mergeCookies(cookie, parseCookieHeaders(response.headers)),
  );
  const html = await followed.response.text();
  if (!html.includes("/advanced/logout.php")) {
    throw new Error(`tendo.net login did not reach the advanced page: ${summarizeTendoPage(html, followed.url, followed.response.status)}`);
  }
  return followed.cookie;
}

async function findReportFormPage(env, cookie) {
  const candidates = [env.REPORT_ONLINE_FORM_URL, ...TENDO_REPORT_FORM_URLS].filter(Boolean);
  const diagnostics = [];
  let currentCookie = cookie;

  for (const candidate of candidates) {
    const page = await fetchWithCookies(new URL(candidate, TENDO_ONLINE_URL).toString(), currentCookie);
    currentCookie = page.cookie;
    const html = await page.response.text();
    if (html.includes("申請者登録フォーム")) {
      throw new Error("tendo.net applicant registration is not completed");
    }
    if (extractReportFormAction(html) || hasReportFormFields(html)) {
      return { ...page, html, cookie: currentCookie };
    }
    const iframeUrl = extractReportIframeUrl(html);
    if (iframeUrl) {
      const iframePage = await fetchWithCookies(new URL(iframeUrl, page.url).toString(), currentCookie);
      currentCookie = iframePage.cookie;
      const iframeHtml = await iframePage.response.text();
      if (extractReportFormAction(iframeHtml) || hasReportFormFields(iframeHtml)) {
        return { ...iframePage, html: iframeHtml, cookie: currentCookie };
      }
      diagnostics.push(summarizeTendoPage(iframeHtml, iframePage.url, iframePage.response.status));
    }
    diagnostics.push(summarizeTendoPage(html, page.url, page.response.status));
  }
  throw new Error(`tendo.net online report form was not found: ${diagnostics.join(" || ")}`);
}

async function submitOnlineReport(env, ceremony, settings, cookie, pdfBuffer) {
  if (env.REPORT_REMOTE_SUBMIT !== "true") {
    throw new Error("REPORT_REMOTE_SUBMIT is not true");
  }
  const onlinePage = await findReportFormPage(env, cookie);
  const onlineHtml = onlinePage.html;
  const formAction = extractReportFormAction(onlineHtml);
  const postUrl = formAction || onlinePage.url;
  const fileField = env.REPORT_ONLINE_FILE_FIELD || "up_file[]";

  const formData = new FormData();
  formData.set("name", settings.senderName);
  formData.set("dendokai", settings.branchName);
  formData.set("title", `${ceremony.name || "毎日集計"} 集計表`);
  formData.set("text", "");
  formData.set(fileField, new File([pdfBuffer], "dailytally-report.pdf", { type: "application/pdf" }));
  formData.set("mirokuji", "弥勒寺へ送信");

  const resolvedPostUrl = new URL(postUrl, onlinePage.url).toString();
  const response = await fetch(resolvedPostUrl, {
    method: "POST",
    headers: { cookie: onlinePage.cookie, referer: onlinePage.url },
    body: formData,
    redirect: "follow",
  });
  const text = await response.text();
  if (!response.ok || /エラー|失敗|ログイン/.test(text)) {
    throw new Error(`tendo.net report submit returned ${response.status}: url=${resolvedPostUrl}, formAction=${formAction || "(none)"}`);
  }
  return {
    confirmed: hasTendoSubmitSuccess(text),
    summary: summarizeSubmitResult(text, response.url || resolvedPostUrl, response.status),
  };
}

async function sendNotification(env, settings, subject, body) {
  if (!env.RESEND_API_KEY || !settings.notifyEmail) {
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.REPORT_NOTIFY_FROM || "Dailytally <onboarding@resend.dev>",
      to: settings.notifyEmail,
      subject,
      text: body,
    }),
  });
}

async function sendReport(env, ceremony, settings, sendKey, startMessage) {
  const startAt = formatJSTTimestamp();
  await updateReportAttempt(env.DB, { lastAttemptAt: startAt, lastAttemptKey: sendKey, lastError: "" });
  await appendReportHistory(env.DB, {
    sentAt: startAt,
    sendKey,
    status: "送信開始",
    message: startMessage,
    ceremonyId: ceremony.id,
  });

  try {
    const cookie = await tendoLogin(env);
    const pdfBuffer = await generateSummaryPdf(env, ceremony.id);
    const result = await submitOnlineReport(env, ceremony, settings, cookie, pdfBuffer);
    const successAt = formatJSTTimestamp();
    await updateReportSuccess(env.DB, { lastSuccessAt: successAt, lastSentKey: sendKey });
    await appendReportHistory(env.DB, {
      sentAt: successAt,
      sendKey,
      status: result.confirmed ? "成功確認済み" : "送信結果未確認",
      message: result.summary,
      ceremonyId: ceremony.id,
    });
    await sendNotification(
      env,
      settings,
      result.confirmed ? "オンライン報告を送信しました" : "オンライン報告の送信結果を確認できません",
      `${result.confirmed ? "送信完了" : "送信結果未確認"}: ${successAt}\n${result.summary}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateReportError(env.DB, message);
    await appendReportHistory(env.DB, {
      sentAt: formatJSTTimestamp(),
      sendKey,
      status: "失敗",
      message,
      ceremonyId: ceremony.id,
    });
    await sendNotification(env, settings, "オンライン報告の送信に失敗しました", message);
    throw error;
  }
}

export async function runScheduledReport(env) {
  // 早期短絡: enabled=false / sendTime 不正 / 時刻前 なら DB 1回で抜ける
  const settings = await getReportSettings(env.DB);
  if (!settings.enabled || !/^\d{2}:\d{2}$/.test(settings.sendTime || "")) {
    return;
  }
  const now = new Date();
  const jst = nowJST(now);
  const [hour, minute] = settings.sendTime.split(":").map(Number);
  if (jst.getUTCHours() * 60 + jst.getUTCMinutes() < hour * 60 + minute) {
    return;
  }
  const ceremonyId = await getActiveCeremonyId(env.DB);
  if (!ceremonyId) return;
  const ceremonyRow = await getCeremony(env.DB, ceremonyId);
  if (!ceremonyRow) return;
  const ceremony = await ensureCeremonyDates(env.DB, ceremonyRow);
  if (!isReportDue(settings, ceremony, now)) {
    return;
  }
  const today = jst.toISOString().slice(0, 10);
  const sendKey = buildSendKey(ceremony.id, today, settings.sendTime);
  await sendReport(env, ceremony, settings, sendKey, `${settings.sendTime} の自動送信を開始`);
}

export async function runManualReport(env) {
  const ceremonyId = await getActiveCeremonyId(env.DB);
  if (!ceremonyId) {
    throw new Error("active ceremony is not set");
  }
  const ceremonyRow = await getCeremony(env.DB, ceremonyId);
  if (!ceremonyRow) {
    throw new Error(`ceremony ${ceremonyId} not found`);
  }
  const ceremony = await ensureCeremonyDates(env.DB, ceremonyRow);
  const settings = await getReportSettings(env.DB);
  const sendKey = `manual:${ceremony.id}:${formatJSTTimestamp()}`;
  await sendReport(env, ceremony, settings, sendKey, "手動送信を開始");
}
