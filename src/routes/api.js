import { badRequest, forbidden, jsonResponse, notFound } from "../lib/response.js";
import {
  canWriteAdmin,
  canWriteFellowship,
  getCurrentUser,
  refreshSessionUser,
} from "../lib/auth.js";
import {
  ensureCeremonyDates,
  getActiveCeremonyId,
  getCeremony,
  getCeremonyDatePreset,
  listAllItemsByCeremony,
  listCeremonies,
  setActiveCeremonyId,
  updateCeremonyDates,
} from "../services/ceremonies.js";
import { listFellowships, getFellowshipByName } from "../services/fellowships.js";
import {
  getPreviousCumulativeValue,
  listTallies,
  upsertTally,
} from "../services/tallies.js";
import {
  listFellowshipTargets,
  listSummaryTargetOverrides,
  upsertFellowshipTarget,
  upsertSummaryTargetOverride,
} from "../services/targets.js";
import {
  getReportSettings,
  listReportHistory,
  updateReportSettings,
} from "../services/reports.js";
import { generateSummaryPdf } from "../services/pdf.js";
import { runManualReport } from "../services/report-sender.js";
import { todayISO } from "../lib/dates.js";

async function readBootstrap(env) {
  const [fellowships, ceremonies, itemsByCeremony] = await Promise.all([
    listFellowships(env.DB),
    listCeremonies(env.DB),
    listAllItemsByCeremony(env.DB),
  ]);
  let activeId = await getActiveCeremonyId(env.DB);
  if (!activeId && ceremonies.length) {
    activeId = ceremonies[0].id;
    await setActiveCeremonyId(env.DB, activeId);
  }
  const normalizedCeremonies = [];
  for (const ceremony of ceremonies) {
    const normalized = await ensureCeremonyDates(env.DB, ceremony);
    normalizedCeremonies.push({ ...normalized, items: itemsByCeremony.get(ceremony.id) || [] });
  }
  const activeData = await readCeremonyData(env, activeId);
  const [reportSettings, reportHistory] = await Promise.all([
    getReportSettings(env.DB),
    listReportHistory(env.DB, 20),
  ]);
  return {
    activeCeremonyId: activeId,
    fellowships,
    ceremonies: normalizedCeremonies,
    activeCeremonyData: activeData,
    reportSettings,
    reportHistory,
  };
}

async function readCeremonyData(env, ceremonyId) {
  if (!ceremonyId) {
    return { tallies: [], fellowshipTargets: [], summaryOverrides: [] };
  }
  const [tallies, fellowshipTargets, summaryOverrides] = await Promise.all([
    listTallies(env.DB, ceremonyId),
    listFellowshipTargets(env.DB, ceremonyId),
    listSummaryTargetOverrides(env.DB, ceremonyId),
  ]);
  return { ceremonyId, tallies, fellowshipTargets, summaryOverrides };
}

async function handleMe(request, env) {
  const refreshed = await refreshSessionUser(request, env);
  if (refreshed?.user) {
    const headers = refreshed.cookie ? { "set-cookie": refreshed.cookie } : {};
    return jsonResponse(refreshed.user, { headers });
  }
  return jsonResponse(getCurrentUser(request));
}

async function handleBootstrap(request, env) {
  const data = await readBootstrap(env);
  const refreshed = await refreshSessionUser(request, env);
  const user = refreshed?.user || getCurrentUser(request);
  const headers = refreshed?.cookie ? { "set-cookie": refreshed.cookie } : {};
  return jsonResponse({ user, ...data }, { headers });
}

async function handleActiveCeremony(request, env) {
  const body = await request.json();
  const ceremonyId = Number(body.ceremonyId);
  if (!ceremonyId) {
    return badRequest("ceremonyId required");
  }
  const ceremony = await getCeremony(env.DB, ceremonyId);
  if (!ceremony) {
    return notFound();
  }
  await setActiveCeremonyId(env.DB, ceremonyId);
  await ensureCeremonyDates(env.DB, ceremony);
  const data = await readCeremonyData(env, ceremonyId);
  return jsonResponse({ ok: true, activeCeremonyId: ceremonyId, activeCeremonyData: data });
}

async function handleCeremonySettings(request, env) {
  if (!canWriteAdmin(request)) return forbidden();
  const body = await request.json();
  const ceremonyId = Number(body.ceremonyId);
  if (!ceremonyId) return badRequest("ceremonyId required");
  const ceremony = await getCeremony(env.DB, ceremonyId);
  if (!ceremony) return notFound();

  const preset = getCeremonyDatePreset(ceremonyId);
  await updateCeremonyDates(env.DB, ceremonyId, {
    beginAt: body.beginAt || "",
    endAt: body.endAt || "",
    seekersStartAt: body.seekersStartAt || "",
    datePresetKey: preset ? `custom:${preset.key}` : ceremony.datePresetKey || "",
  });
  const updated = await getCeremony(env.DB, ceremonyId);
  return jsonResponse({ ok: true, ceremony: updated });
}

async function handleTallies(request, env) {
  const body = await request.json();
  const ceremonyId = Number(body.ceremonyId);
  const fellowshipName = String(body.fellowshipName || "");
  const itemId = Number(body.itemId);
  const date = String(body.date || "");
  const rawValue = body.value;
  if (!ceremonyId || !fellowshipName || !itemId || !date) {
    return badRequest("ceremonyId, fellowshipName, itemId, date are required");
  }
  if (!canWriteFellowship(request, fellowshipName)) {
    return forbidden();
  }
  const fellowship = await getFellowshipByName(env.DB, fellowshipName);
  if (!fellowship) return badRequest("unknown fellowship");

  const isClearing = String(rawValue ?? "") === "";
  const value = Math.max(0, Number(rawValue) || 0);
  if (!isClearing && value > 0) {
    const prev = await getPreviousCumulativeValue(env.DB, {
      ceremonyId,
      fellowshipId: fellowship.id,
      itemId,
      date,
    });
    if (prev > 0 && value < prev) {
      return jsonResponse(
        { error: `累計数のため、前回入力値（${prev}）以上の数字を入力してください。` },
        { status: 400 },
      );
    }
  }
  const user = getCurrentUser(request);
  await upsertTally(env.DB, {
    ceremonyId,
    fellowshipId: fellowship.id,
    itemId,
    date,
    value,
    updatedBy: user.loginId || null,
  });
  return jsonResponse({ ok: true, value });
}

async function handleFellowshipTargets(request, env) {
  const body = await request.json();
  const ceremonyId = Number(body.ceremonyId);
  const fellowshipName = String(body.fellowshipName || "");
  const itemId = Number(body.itemId);
  const value = Math.max(0, Number(body.value) || 0);
  if (!ceremonyId || !fellowshipName || !itemId) {
    return badRequest("ceremonyId, fellowshipName, itemId are required");
  }
  if (!canWriteFellowship(request, fellowshipName)) {
    return forbidden();
  }
  const ceremony = await getCeremony(env.DB, ceremonyId);
  if (!ceremony) return notFound();
  if (!canWriteAdmin(request) && ceremony.beginAt && todayISO() > ceremony.beginAt) {
    return forbidden();
  }
  const fellowship = await getFellowshipByName(env.DB, fellowshipName);
  if (!fellowship) return badRequest("unknown fellowship");
  await upsertFellowshipTarget(env.DB, { ceremonyId, fellowshipId: fellowship.id, itemId, value });
  return jsonResponse({ ok: true, value });
}

async function handleSummaryTargets(request, env) {
  if (!canWriteAdmin(request)) return forbidden();
  const body = await request.json();
  const ceremonyId = Number(body.ceremonyId);
  const itemId = Number(body.itemId);
  const value = Math.max(0, Number(body.value) || 0);
  if (!ceremonyId || !itemId) {
    return badRequest("ceremonyId, itemId are required");
  }
  await upsertSummaryTargetOverride(env.DB, { ceremonyId, itemId, value });
  return jsonResponse({ ok: true, value });
}

async function handleReportSettings(request, env) {
  if (!canWriteAdmin(request)) return forbidden();
  const body = await request.json();
  await updateReportSettings(env.DB, {
    enabled: Boolean(body.enabled),
    sendTime: body.sendTime || "22:00",
    senderName: body.senderName || "",
    branchName: body.branchName || "",
    branchCode: body.branchCode || "",
    notifyEmail: body.notifyEmail || "",
  });
  return jsonResponse({ ok: true, reportSettings: await getReportSettings(env.DB) });
}

async function handleReportPdf(request, env) {
  if (!canWriteAdmin(request)) return forbidden();
  const url = new URL(request.url);
  let ceremonyId = Number(url.searchParams.get("ceremonyId") || 0);
  if (!ceremonyId) {
    ceremonyId = await getActiveCeremonyId(env.DB);
  }
  if (!ceremonyId) return badRequest("ceremonyId required");
  const pdf = await generateSummaryPdf(env, ceremonyId);
  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="dailytally-report.pdf"',
    },
  });
}

async function handleReportSend(request, env) {
  if (!canWriteAdmin(request)) return forbidden();
  await runManualReport(env);
  const [reportSettings, reportHistory] = await Promise.all([
    getReportSettings(env.DB),
    listReportHistory(env.DB, 20),
  ]);
  return jsonResponse({ ok: true, reportSettings, reportHistory, latestHistory: reportHistory[0] || null });
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/me" && request.method === "GET") return handleMe(request, env);
  if (path === "/api/bootstrap" && request.method === "GET") return handleBootstrap(request, env);
  if (path === "/api/active-ceremony" && request.method === "POST") return handleActiveCeremony(request, env);
  if (path === "/api/ceremony-settings" && request.method === "POST") return handleCeremonySettings(request, env);
  if (path === "/api/tallies" && request.method === "POST") return handleTallies(request, env);
  if (path === "/api/fellowship-targets" && request.method === "POST") return handleFellowshipTargets(request, env);
  if (path === "/api/summary-targets" && request.method === "POST") return handleSummaryTargets(request, env);
  if (path === "/api/report-settings" && request.method === "POST") return handleReportSettings(request, env);
  if (path === "/api/report-pdf" && request.method === "GET") return handleReportPdf(request, env);
  if (path === "/api/report-send" && request.method === "POST") return handleReportSend(request, env);

  return notFound();
}
