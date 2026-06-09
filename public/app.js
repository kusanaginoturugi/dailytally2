// dailytally2 frontend
const REFRESH_INTERVAL_MS = 15000;
const ACTIVE_TAB_KEY = "daily-tally2-active-tab";

const appTitle = document.getElementById("appTitle");
const userStatus = document.getElementById("userStatus");
const tabButtons = document.getElementById("tabButtons");
const pageContainer = document.getElementById("pageContainer");

const state = {
  user: null,
  activeCeremonyId: null,
  fellowships: [],
  ceremonies: [],
  activeCeremonyData: { ceremonyId: null, tallies: [], fellowshipTargets: [], summaryOverrides: [] },
  reportSettings: defaultReportSettings(),
  reportHistory: [],
};
let activeTab = "admin";

init();

function defaultReportSettings() {
  return {
    enabled: false,
    sendTime: "22:00",
    senderName: "聖明王院事務局",
    branchName: "聖明王院",
    branchCode: "99300",
    notifyEmail: "jimmyouou@gmail.com",
    lastAttemptAt: "",
    lastAttemptKey: "",
    lastSuccessAt: "",
    lastSentKey: "",
    lastError: "",
  };
}

function redirectToLogin() {
  const rd = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/auth/login?rd=${encodeURIComponent(rd)}`;
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: "manual" });
  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    redirectToLogin();
    throw new Error("Authentication required");
  }
  if (response.headers.get("content-type")?.includes("text/html")) {
    redirectToLogin();
    throw new Error("Authentication required");
  }
  return response;
}

async function apiGet(url) {
  const response = await apiFetch(url);
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
  return response.json();
}

async function apiSend(url, body, method = "POST") {
  const response = await apiFetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }
  return { ok: response.ok, status: response.status, payload };
}

async function init() {
  await bootstrap();
  activeTab = getSavedActiveTab();
  render();
  setInterval(refreshActiveCeremony, REFRESH_INTERVAL_MS);
}

async function bootstrap() {
  try {
    const data = window.DAILY_TALLY_USER && !state.user ? null : null;
    const remote = await apiGet("/api/bootstrap");
    Object.assign(state, normalizeRemoteState(remote));
    if (window.DAILY_TALLY_USER && !state.user) {
      state.user = normalizeUser(window.DAILY_TALLY_USER);
    }
  } catch (error) {
    console.error("ブートストラップに失敗しました。", error);
  }
}

function normalizeRemoteState(remote) {
  return {
    user: normalizeUser(remote.user),
    activeCeremonyId: remote.activeCeremonyId || (remote.ceremonies?.[0]?.id ?? null),
    fellowships: remote.fellowships || [],
    ceremonies: remote.ceremonies || [],
    activeCeremonyData: remote.activeCeremonyData || { tallies: [], fellowshipTargets: [], summaryOverrides: [] },
    reportSettings: { ...defaultReportSettings(), ...(remote.reportSettings || {}) },
    reportHistory: remote.reportHistory || [],
  };
}

function normalizeUser(user) {
  if (!user) return null;
  const normalized = {
    loginId: user.loginId || "",
    fellowship: user.fellowship || "",
    name: user.name || "",
    email: user.email || "",
    role: user.role || "",
  };
  return Object.values(normalized).some((value) => String(value || "").trim() !== "") ? normalized : null;
}

async function refreshActiveCeremony() {
  if (document.activeElement && ["INPUT", "SELECT"].includes(document.activeElement.tagName)) {
    return;
  }
  try {
    const remote = await apiGet("/api/bootstrap");
    Object.assign(state, normalizeRemoteState(remote));
    render();
  } catch (error) {
    console.error("最新データを取得できませんでした。", error);
  }
}

function getActiveCeremony() {
  return state.ceremonies.find((c) => c.id === state.activeCeremonyId) || state.ceremonies[0] || null;
}

function getActiveItems() {
  return getActiveCeremony()?.items || [];
}

function getFellowshipByName(name) {
  return state.fellowships.find((f) => f.name === name) || null;
}

function getCeremonyName() {
  const ceremony = getActiveCeremony();
  if (!ceremony) return "毎日集計";
  return `第${ceremony.nextNumber}回${ceremony.name}`;
}

function fellowshipNames() {
  return state.fellowships.map((f) => f.name);
}

function isAuthenticated() {
  return Boolean(state.user);
}

function canEditAdmin() {
  return isAuthenticated() && state.user.role === "admin";
}

// 管理ページの表示可否。役割によらず常に閲覧できる (操作可否は canEditAdmin)。
function canViewAdmin() {
  return true;
}

function canEditFellowship(name) {
  if (!isAuthenticated()) return false;
  if (canEditAdmin()) return true;
  return state.user.fellowship === name;
}

function canEditFellowshipTarget(name) {
  if (!canEditFellowship(name)) return false;
  if (canEditAdmin()) return true;
  const ceremony = getActiveCeremony();
  return !ceremony?.beginAt || todayISO() <= ceremony.beginAt;
}

function todayISO() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function currentYear() {
  return Number(todayISO().slice(0, 4));
}

function toISODate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDaysISO(iso, days) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function formatShortDate(iso) {
  if (!iso) return "";
  const date = parseISODate(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function parseAdminDateInput(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/[.／]/g, "/").replace(/-/g, "/");
  const fullDate = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  const shortDate = normalized.match(/^(\d{1,2})\/(\d{1,2})$/);
  const year = fullDate ? Number(fullDate[1]) : currentYear();
  const month = Number(fullDate ? fullDate[2] : shortDate?.[1]);
  const day = Number(fullDate ? fullDate[3] : shortDate?.[2]);
  if (!month || !day) return "";
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return "";
  }
  return toISODate(date);
}

function getWeekDates() {
  const ceremony = getActiveCeremony();
  if (!ceremony?.beginAt || !ceremony?.endAt) return [];
  const dates = [];
  let current = ceremony.beginAt;
  while (current < ceremony.endAt && dates.length < 366) {
    dates.push({ id: current, label: formatShortDate(current) });
    current = addDaysISO(current, 1);
  }
  return dates;
}

function getTallyValue(fellowshipId, itemId, date) {
  const found = state.activeCeremonyData.tallies.find(
    (t) => t.fellowshipId === fellowshipId && t.itemId === itemId && t.date === date,
  );
  return found ? Number(found.value) || 0 : 0;
}

function setLocalTallyValue(fellowshipId, itemId, date, value) {
  const list = state.activeCeremonyData.tallies;
  const index = list.findIndex(
    (t) => t.fellowshipId === fellowshipId && t.itemId === itemId && t.date === date,
  );
  if (index === -1) {
    list.push({ fellowshipId, itemId, date, value });
  } else {
    list[index].value = value;
  }
}

function getFellowshipTargetValue(fellowshipId, itemId) {
  const found = state.activeCeremonyData.fellowshipTargets.find(
    (t) => t.fellowshipId === fellowshipId && t.itemId === itemId,
  );
  return found ? Number(found.value) || 0 : 0;
}

function setLocalFellowshipTarget(fellowshipId, itemId, value) {
  const list = state.activeCeremonyData.fellowshipTargets;
  const index = list.findIndex((t) => t.fellowshipId === fellowshipId && t.itemId === itemId);
  if (index === -1) list.push({ fellowshipId, itemId, value });
  else list[index].value = value;
}

function getSummaryOverride(itemId) {
  const found = state.activeCeremonyData.summaryOverrides.find((o) => o.itemId === itemId);
  return found ? found.value : null;
}

function setLocalSummaryOverride(itemId, value) {
  const list = state.activeCeremonyData.summaryOverrides;
  const index = list.findIndex((o) => o.itemId === itemId);
  if (index === -1) list.push({ itemId, value });
  else list[index].value = value;
}

function getCarriedValue(fellowshipId, itemId, untilDate) {
  let carried = 0;
  for (const date of getWeekDates()) {
    if (date.id > untilDate) break;
    const value = getTallyValue(fellowshipId, itemId, date.id);
    if (value > 0) carried = value;
  }
  return carried;
}

function getPreviousValue(fellowshipId, itemId, date) {
  let previous = 0;
  for (const d of getWeekDates()) {
    if (d.id >= date) break;
    const value = getTallyValue(fellowshipId, itemId, d.id);
    if (value > 0) previous = value;
  }
  return previous;
}

function getDayTotals(date) {
  const items = getActiveItems();
  const totals = Object.fromEntries(items.map((item) => [item.id, 0]));
  for (const fellowship of state.fellowships) {
    for (const item of items) {
      totals[item.id] += getCarriedValue(fellowship.id, item.id, date);
    }
  }
  return totals;
}

function getCumulativeDayTotals(date) {
  return date <= todayISO() ? getDayTotals(date) : null;
}

function getFinalTotals() {
  const ceremony = getActiveCeremony();
  if (!ceremony?.endAt || ceremony.endAt > todayISO()) return null;
  const items = getActiveItems();
  const totals = Object.fromEntries(items.map((item) => [item.id, 0]));
  for (const fellowship of state.fellowships) {
    for (const item of items) {
      const finalValue = getTallyValue(fellowship.id, item.id, ceremony.endAt);
      const carried = getCarriedValue(fellowship.id, item.id, ceremony.endAt);
      totals[item.id] += finalValue || carried;
    }
  }
  return totals;
}

function getTargetTotals() {
  const items = getActiveItems();
  const totals = Object.fromEntries(items.map((item) => [item.id, 0]));
  for (const fellowship of state.fellowships) {
    for (const item of items) {
      totals[item.id] += getFellowshipTargetValue(fellowship.id, item.id);
    }
  }
  return totals;
}

function getSummaryTargetValue(itemId, fallback) {
  const override = getSummaryOverride(itemId);
  return override !== null ? override : fallback;
}

function getSavedActiveTab() {
  const requested = new URLSearchParams(window.location.search).get("tab");
  if (isKnownTab(requested)) return requested;
  const saved = localStorage.getItem(ACTIVE_TAB_KEY);
  if (isKnownTab(saved)) return saved;
  return canEditAdmin() ? "admin" : (state.user?.fellowship || fellowshipNames()[0]);
}

function isKnownTab(name) {
  if (!name) return false;
  if (name === "admin") return canViewAdmin();
  if (name === "summary") return true;
  return fellowshipNames().includes(name);
}

function getUserLabel() {
  if (!isAuthenticated()) return "未ログイン";
  const username = state.user.loginId || state.user.email || state.user.name || "ユーザー";
  const fellowship = state.user.fellowship || "伝道会未設定";
  const role = state.user.role === "admin" ? " / 権限: 管理者" : "";
  return `ユーザー: ${username} / 伝道会: ${fellowship}${role}`;
}

// -- 入力 UI ヘルパ --

function selectOnFocus(input) {
  input.addEventListener("focus", () => input.select());
}

function updateNumberInputSize(input) {
  input.classList.toggle("compact-number", input.value.length >= 4);
}

function setInputWarning(container, message) {
  const warning = container?.querySelector(".input-warning");
  if (!warning) return;
  warning.textContent = message || "";
  warning.hidden = !message;
}

function setInputInvalid(input, message) {
  input.classList.toggle("invalid-number", Boolean(message));
  input.setAttribute("aria-invalid", message ? "true" : "false");
  input.title = message || "";
}

function createNumberInput(currentValue, onChange, className = "", options = {}) {
  const input = document.createElement("input");
  input.className = className;
  input.type = "text";
  input.inputMode = "numeric";
  input.pattern = "[0-9]*";
  input.value = currentValue === 0 ? "" : String(currentValue);
  updateNumberInputSize(input);
  selectOnFocus(input);
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "");
    updateNumberInputSize(input);
    const message = options.validate ? options.validate(input.value) : "";
    setInputInvalid(input, message);
    setInputWarning(options.warningContainer, message);
    if (message) return;
    onChange(input.value);
  });
  return input;
}

function appendUnit(cell, unit) {
  if (!unit) return;
  const unitEl = document.createElement("span");
  unitEl.className = "input-unit";
  unitEl.textContent = unit;
  cell.appendChild(unitEl);
}

function appendReadonlyValue(cell, value, unit) {
  const span = document.createElement("span");
  span.className = "input-value";
  span.textContent = value === 0 ? "" : String(value);
  cell.appendChild(span);
  appendUnit(cell, unit);
}

// -- 書き込み API --

async function postTally(fellowshipName, itemId, date, value) {
  const ceremony = getActiveCeremony();
  if (!ceremony) return { ok: false };
  return apiSend("/api/tallies", {
    ceremonyId: ceremony.id,
    fellowshipName,
    itemId,
    date,
    value,
  });
}

async function postFellowshipTarget(fellowshipName, itemId, value) {
  const ceremony = getActiveCeremony();
  if (!ceremony) return { ok: false };
  return apiSend("/api/fellowship-targets", {
    ceremonyId: ceremony.id,
    fellowshipName,
    itemId,
    value,
  });
}

async function postSummaryOverride(itemId, value) {
  const ceremony = getActiveCeremony();
  if (!ceremony) return { ok: false };
  return apiSend("/api/summary-targets", {
    ceremonyId: ceremony.id,
    itemId,
    value,
  });
}

async function saveCeremonySettings({ beginAt, endAt, seekersStartAt }) {
  const ceremony = getActiveCeremony();
  if (!ceremony) return;
  await apiSend("/api/ceremony-settings", {
    ceremonyId: ceremony.id,
    beginAt,
    endAt,
    seekersStartAt,
  });
  // ローカルにも反映
  ceremony.beginAt = beginAt;
  ceremony.endAt = endAt;
  ceremony.seekersStartAt = seekersStartAt;
}

async function saveReportSettings(fields) {
  const result = await apiSend("/api/report-settings", fields);
  if (result.ok && result.payload?.reportSettings) {
    state.reportSettings = { ...defaultReportSettings(), ...result.payload.reportSettings };
  }
}

async function switchCeremony(ceremonyId) {
  const result = await apiSend("/api/active-ceremony", { ceremonyId });
  if (result.ok && result.payload) {
    state.activeCeremonyId = result.payload.activeCeremonyId;
    state.activeCeremonyData = result.payload.activeCeremonyData || {
      tallies: [],
      fellowshipTargets: [],
      summaryOverrides: [],
    };
  }
}

// -- レンダリング --

function renderTabs() {
  tabButtons.innerHTML = "";

  for (const name of fellowshipNames()) {
    const button = document.createElement("button");
    button.className = `tab-button ${activeTab === name ? "active" : ""}`;
    button.textContent = name;
    button.type = "button";
    button.addEventListener("click", () => {
      activeTab = name;
      localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
      render();
    });
    tabButtons.appendChild(button);
  }

  const summaryButton = document.createElement("button");
  summaryButton.className = `tab-button ${activeTab === "summary" ? "active" : ""}`;
  summaryButton.textContent = "合計ページ";
  summaryButton.type = "button";
  summaryButton.addEventListener("click", () => {
    activeTab = "summary";
    localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    render();
  });
  tabButtons.appendChild(summaryButton);

  if (canViewAdmin()) {
    const adminButton = document.createElement("button");
    adminButton.className = `tab-button ${activeTab === "admin" ? "active" : ""}`;
    adminButton.textContent = "管理ページ";
    adminButton.type = "button";
    adminButton.addEventListener("click", () => {
      activeTab = "admin";
      localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
      render();
    });
    tabButtons.appendChild(adminButton);
  }
}

function fillInputHeader(row) {
  row.innerHTML = "";
  const first = document.createElement("th");
  first.textContent = "日付";
  row.appendChild(first);
  const ceremony = getActiveCeremony();
  for (const item of getActiveItems()) {
    const th = document.createElement("th");
    if (item.key === "seekers") {
      const start = ceremony?.seekersStartAt;
      th.append("得道者数", document.createElement("br"), start ? `(${formatShortDate(start)}～)` : "");
    } else if (item.key === "tenchi") {
      th.append("天地免劫", document.createElement("br"), "護摩木");
    } else if (item.key === "ryuge") {
      th.append("三會龍華", document.createElement("br"), "之御柱");
    } else if (item.key === "sanki_proxy") {
      th.append("三期滅劫之霊木", document.createElement("br"), "代理奉納");
    } else if (item.key === "ryuge_proxy") {
      th.append("三會龍華之御柱", document.createElement("br"), "代理奉納");
    } else if (item.key === "maso") {
      th.append("媽祖救航灯", document.createElement("br"), "代理奉納");
    } else {
      th.textContent = item.name;
    }
    row.appendChild(th);
  }
}

function fillSummaryHeader(row) {
  row.innerHTML = "";
  row.appendChild(document.createElement("th"));
  const ceremony = getActiveCeremony();
  for (const item of getActiveItems()) {
    const th = document.createElement("th");
    if (item.key === "seekers") {
      th.textContent = "得道者数";
      if (ceremony?.seekersStartAt) {
        const span = document.createElement("span");
        span.className = "horizontal-date";
        span.textContent = `(${formatShortDate(ceremony.seekersStartAt)}～)`;
        th.appendChild(span);
      }
    } else if (item.key === "tenchi") {
      th.append("この護摩供に", document.createElement("br"), "向けての", document.createElement("br"), "天地免劫護摩木");
    } else if (item.key === "goma") {
      th.append("この護摩供に", document.createElement("br"), "向けての", document.createElement("br"), "各種護摩木");
    } else if (item.key === "ryuge") {
      th.textContent = "三會龍華之御柱";
    } else if (item.key === "ryuge_proxy") {
      th.append("三會龍華之御柱", document.createElement("br"), "代理奉納");
    } else if (item.key === "sanki_proxy") {
      th.append("三期滅劫之霊木", document.createElement("br"), "代理奉納");
    } else if (item.key === "jigoku") {
      th.append("地獄曼荼羅會", document.createElement("br"), "代理奉納");
    } else if (item.key === "kokujyo") {
      th.append("黒縄供養紐・", document.createElement("br"), "水子萬灯會", document.createElement("br"), "代理奉納");
    } else if (item.key === "maso") {
      th.append("媽祖救航灯", document.createElement("br"), "代理奉納");
    } else if (item.key === "hokuto_segaki") {
      th.append("北斗施餓鬼供養", document.createElement("br"), "護摩木代理奉納");
    } else if (item.key === "inau") {
      th.append("イナウ・", document.createElement("br"), "なで玄武・", document.createElement("br"), "北斗鎮圧札");
    } else if (item.key === "junishinsho") {
      th.append("十二神将板・", document.createElement("br"), "龍樹滅業棒");
    } else if (item.key === "water") {
      const summary = item.summaryName;
      if (summary === "御神水・命泉・泉・龍華水・禄存五聖杯") {
        th.append("御神水・命泉・", document.createElement("br"), "泉・龍華水・", document.createElement("br"), "禄存五聖杯");
      } else if (summary === "御神水・泉・龍華水等") {
        th.append("御神水・泉・", document.createElement("br"), "龍華水等");
      } else if (summary === "御神水・命泉・泉・龍華水等") {
        th.append("御神水・命泉・", document.createElement("br"), "泉・龍華水等");
      } else if (summary === "御神水・命泉・泉・龍華水") {
        th.append("御神水・命泉・", document.createElement("br"), "泉・龍華水");
      } else {
        th.textContent = summary || item.name;
      }
    } else {
      th.textContent = item.summaryName || item.name;
    }
    row.appendChild(th);
  }
}

function validateCumulative(fellowshipId, itemId, date, value) {
  if (String(value ?? "") === "") return "";
  const next = Number(value) || 0;
  const prev = getPreviousValue(fellowshipId, itemId, date);
  if (prev > 0 && next < prev) {
    return `累計数のため、前回入力値（${prev}）以上の数字を入力してください。`;
  }
  return "";
}

function renderInputPage(fellowshipName) {
  const fellowship = getFellowshipByName(fellowshipName);
  if (!fellowship) {
    pageContainer.innerHTML = "";
    return;
  }
  const template = document.getElementById("inputPageTemplate");
  const content = template.content.cloneNode(true);
  content.querySelector(".page-title").textContent = `${getCeremonyName()}　${fellowshipName}`;
  const section = content.querySelector(".input-page");
  fillInputHeader(content.querySelector("#inputHeaderRow"));

  const tbody = content.querySelector("tbody");
  const items = getActiveItems();
  const editable = canEditFellowship(fellowshipName);

  // 目標行
  const targetRow = document.createElement("tr");
  targetRow.className = "target-row";
  const targetLabel = document.createElement("th");
  targetLabel.textContent = "目標";
  targetRow.appendChild(targetLabel);
  for (const item of items) {
    const td = document.createElement("td");
    const current = getFellowshipTargetValue(fellowship.id, item.id);
    if (canEditFellowshipTarget(fellowshipName)) {
      const input = createNumberInput(current, async (raw) => {
        const value = Math.max(0, Number(raw) || 0);
        setLocalFellowshipTarget(fellowship.id, item.id, value);
        await postFellowshipTarget(fellowshipName, item.id, value);
      }, "target-input");
      td.appendChild(input);
      appendUnit(td, item.unit);
    } else {
      appendReadonlyValue(td, current, item.unit);
    }
    targetRow.appendChild(td);
  }
  tbody.appendChild(targetRow);

  // 日付行
  for (const date of getWeekDates()) {
    const tr = document.createElement("tr");
    const dateCell = document.createElement("th");
    dateCell.textContent = date.label;
    tr.appendChild(dateCell);
    for (const item of items) {
      const td = document.createElement("td");
      const current = getTallyValue(fellowship.id, item.id, date.id);
      const canEditDate = editable && date.id >= todayISO();
      if (canEditDate) {
        const input = createNumberInput(current, async (raw) => {
          const value = Math.max(0, Number(raw) || 0);
          const result = await postTally(fellowshipName, item.id, date.id, raw === "" ? "" : value);
          if (result.ok) {
            setLocalTallyValue(fellowship.id, item.id, date.id, value);
            setInputWarning(section, "");
          } else {
            setInputWarning(section, result.payload?.error || "保存に失敗しました");
          }
        }, "", {
          validate: (value) => validateCumulative(fellowship.id, item.id, date.id, value),
          warningContainer: section,
        });
        td.appendChild(input);
        appendUnit(td, item.unit);
      } else {
        appendReadonlyValue(td, current, item.unit);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  // 最終行
  const ceremony = getActiveCeremony();
  const totalRow = content.querySelector("#inputWeeklyTotalRow");
  const finalLabel = document.createElement("th");
  finalLabel.textContent = "最終";
  totalRow.appendChild(finalLabel);
  for (const item of items) {
    const td = document.createElement("td");
    const finalValue = getTallyValue(fellowship.id, item.id, ceremony?.endAt || "");
    const canEditDate = editable && (ceremony?.endAt || "") >= todayISO();
    if (canEditDate) {
      const input = createNumberInput(finalValue, async (raw) => {
        const value = Math.max(0, Number(raw) || 0);
        const result = await postTally(fellowshipName, item.id, ceremony.endAt, raw === "" ? "" : value);
        if (result.ok) {
          setLocalTallyValue(fellowship.id, item.id, ceremony.endAt, value);
          setInputWarning(section, "");
        } else {
          setInputWarning(section, result.payload?.error || "保存に失敗しました");
        }
      }, "", {
        validate: (value) => validateCumulative(fellowship.id, item.id, ceremony?.endAt || "", value),
        warningContainer: section,
      });
      td.appendChild(input);
      appendUnit(td, item.unit);
    } else {
      appendReadonlyValue(td, finalValue, item.unit);
    }
    totalRow.appendChild(td);
  }

  pageContainer.innerHTML = "";
  pageContainer.appendChild(content);
}

function reportStatusText() {
  const r = state.reportSettings;
  const status = r.enabled ? "有効" : "無効";
  const success = r.lastSuccessAt ? ` 最終成功: ${r.lastSuccessAt}` : "";
  const error = r.lastError ? ` 最終エラー: ${r.lastError}` : "";
  return `状態: ${status} / 期間中は毎日 ${r.sendTime} に送信${success}${error}`;
}

function renderReportHistory(listEl) {
  listEl.innerHTML = "";
  if (!state.reportHistory.length) {
    const item = document.createElement("li");
    item.textContent = "履歴はまだありません";
    listEl.appendChild(item);
    return;
  }
  for (const entry of state.reportHistory.slice(0, 10)) {
    const li = document.createElement("li");
    const status = entry.status || "記録";
    const message = entry.message ? ` / ${entry.message}` : "";
    li.textContent = `${entry.at || ""} ${status}${message}`;
    listEl.appendChild(li);
  }
}

async function sendManualReport(button, unlock, statusEl, historyEl, resultEl) {
  const originalText = button.textContent;
  button.disabled = true;
  unlock.disabled = true;
  button.textContent = "送信中...";
  resultEl.textContent = "手動送信中...";
  try {
    const result = await apiSend("/api/report-send", {});
    if (!result.ok) {
      throw new Error(result.payload?.error || `送信に失敗しました (${result.status})`);
    }
    if (result.payload?.reportSettings) {
      state.reportSettings = { ...defaultReportSettings(), ...result.payload.reportSettings };
    }
    if (result.payload?.reportHistory) {
      state.reportHistory = result.payload.reportHistory;
    }
    statusEl.textContent = reportStatusText();
    renderReportHistory(historyEl);
    const latest = result.payload?.latestHistory;
    resultEl.textContent = latest
      ? `手動送信完了: ${latest.status || "記録"} / ${latest.at || ""}`
      : "手動送信完了";
  } catch (error) {
    console.error("手動送信に失敗しました。", error);
    resultEl.textContent = `手動送信エラー: ${error.message || error}`;
  } finally {
    unlock.checked = false;
    unlock.disabled = false;
    button.textContent = originalText;
    button.disabled = true;
  }
}

function renderAdminPage() {
  const template = document.getElementById("adminPageTemplate");
  const content = template.content.cloneNode(true);
  const ceremonySelect = content.querySelector("#ceremonySelect");
  const weekStart = content.querySelector("#weekStart");
  const weekEnd = content.querySelector("#weekEnd");
  const seekerStart = content.querySelector("#seekerStart");
  const reportEnabled = content.querySelector("#reportEnabled");
  const reportSendTime = content.querySelector("#reportSendTime");
  const reportSenderName = content.querySelector("#reportSenderName");
  const reportBranchName = content.querySelector("#reportBranchName");
  const reportBranchCode = content.querySelector("#reportBranchCode");
  const reportNotifyEmail = content.querySelector("#reportNotifyEmail");
  const reportStatus = content.querySelector("#reportStatus");
  const historyList = content.querySelector("#reportHistoryList");
  const manualUnlock = content.querySelector("#manualReportUnlock");
  const manualButton = content.querySelector("#manualReportButton");
  const manualResult = content.querySelector("#manualReportResult");

  const ceremony = getActiveCeremony();
  for (const c of state.ceremonies) {
    const option = document.createElement("option");
    option.value = String(c.id);
    option.textContent = c.name;
    ceremonySelect.appendChild(option);
  }
  ceremonySelect.value = ceremony ? String(ceremony.id) : "";
  weekStart.value = formatShortDate(ceremony?.beginAt);
  weekEnd.value = formatShortDate(ceremony?.endAt);
  seekerStart.value = formatShortDate(ceremony?.seekersStartAt);

  reportEnabled.checked = Boolean(state.reportSettings.enabled);
  reportSendTime.value = state.reportSettings.sendTime || "22:00";
  reportSenderName.value = state.reportSettings.senderName || "";
  reportBranchName.value = state.reportSettings.branchName || "";
  reportBranchCode.value = state.reportSettings.branchCode || "";
  reportNotifyEmail.value = state.reportSettings.notifyEmail || "";
  reportStatus.textContent = reportStatusText();
  renderReportHistory(historyList);

  ceremonySelect.addEventListener("change", async () => {
    const id = Number(ceremonySelect.value);
    await switchCeremony(id);
    render();
  });

  const persistDates = async () => {
    const c = getActiveCeremony();
    if (!c) return;
    const beginAt = parseAdminDateInput(weekStart.value) || todayISO();
    const endAt = parseAdminDateInput(weekEnd.value) || c.endAt || addDaysISO(beginAt, 7);
    const seekersStartAt = parseAdminDateInput(seekerStart.value);
    await saveCeremonySettings({
      beginAt,
      endAt,
      seekersStartAt,
    });
    weekStart.value = formatShortDate(beginAt);
    weekEnd.value = formatShortDate(endAt);
    seekerStart.value = formatShortDate(seekersStartAt);
  };

  weekStart.addEventListener("change", persistDates);
  weekEnd.addEventListener("change", persistDates);
  seekerStart.addEventListener("change", persistDates);

  const persistReport = async () => {
    await saveReportSettings({
      enabled: reportEnabled.checked,
      sendTime: reportSendTime.value || "22:00",
      senderName: reportSenderName.value.trim(),
      branchName: reportBranchName.value.trim(),
      branchCode: reportBranchCode.value.trim() || "99300",
      notifyEmail: reportNotifyEmail.value.trim(),
    });
    reportStatus.textContent = reportStatusText();
  };
  [reportEnabled, reportSendTime, reportSenderName, reportBranchName, reportBranchCode, reportNotifyEmail].forEach(
    (input) => input.addEventListener("change", persistReport),
  );

  manualUnlock.addEventListener("change", () => {
    manualButton.disabled = !manualUnlock.checked;
  });
  manualButton.addEventListener("click", () => {
    if (manualButton.disabled || !manualUnlock.checked) return;
    sendManualReport(manualButton, manualUnlock, reportStatus, historyList, manualResult);
  });

  const syncMastersButton = content.querySelector("#syncMastersButton");
  const syncMastersResult = content.querySelector("#syncMastersResult");
  const fellowshipEnabledList = content.querySelector("#fellowshipEnabledList");
  syncMastersButton.addEventListener("click", async () => {
    await syncMasters(syncMastersButton, syncMastersResult);
    await loadFellowshipEnabledList(fellowshipEnabledList);
  });
  loadFellowshipEnabledList(fellowshipEnabledList);

  if (!canEditAdmin()) {
    content.querySelectorAll("input, button, select, textarea").forEach((el) => {
      el.disabled = true;
    });
    const banner = document.createElement("p");
    banner.className = "admin-readonly-banner";
    banner.textContent = "閲覧モード: 操作は管理者のみ可能です。";
    content.querySelector(".admin-page")?.prepend(banner);
  }

  pageContainer.innerHTML = "";
  pageContainer.appendChild(content);
}

async function loadFellowshipEnabledList(container) {
  try {
    const data = await apiGet("/api/fellowships/all");
    container.innerHTML = "";
    for (const fellowship of data.fellowships || []) {
      const label = document.createElement("label");
      label.className = "fellowship-enabled-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = fellowship.enabled;
      if (!canEditAdmin()) {
        checkbox.disabled = true;
      }
      checkbox.addEventListener("change", async () => {
        checkbox.disabled = true;
        try {
          const result = await apiSend("/api/fellowships/enabled", {
            id: fellowship.id,
            enabled: checkbox.checked,
          });
          if (!result.ok) {
            throw new Error(`保存に失敗しました (${result.status})`);
          }
          const remote = await apiGet("/api/bootstrap");
          Object.assign(state, normalizeRemoteState(remote));
          render();
        } catch (error) {
          console.error("伝道会の有効/無効の切り替えに失敗しました。", error);
          checkbox.checked = !checkbox.checked;
        } finally {
          checkbox.disabled = false;
        }
      });
      label.appendChild(checkbox);
      const name = document.createElement("span");
      name.className = "fellowship-enabled-name";
      name.textContent = fellowship.name;
      label.appendChild(name);
      container.appendChild(label);
    }
  } catch (error) {
    console.error("伝道会一覧の読み込みに失敗しました。", error);
    container.textContent = "伝道会一覧の読み込みに失敗しました。";
  }
}

async function syncMasters(button, resultEl) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "同期中...";
  resultEl.textContent = "";
  try {
    const result = await apiSend("/api/sync/masters", {});
    if (!result.ok) {
      throw new Error(result.payload?.error || `同期に失敗しました (${result.status})`);
    }
    const payload = result.payload || {};
    resultEl.textContent = `同期完了: ${payload.count}件 (master 最終更新: ${payload.masterUpdatedAt || "-"})`;
    try {
      const remote = await apiGet("/api/bootstrap");
      Object.assign(state, normalizeRemoteState(remote));
      render();
    } catch (refreshError) {
      console.error("同期後の再読込に失敗しました。", refreshError);
    }
  } catch (error) {
    console.error("マスタ同期に失敗しました。", error);
    resultEl.textContent = `同期エラー: ${error.message || error}`;
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

async function saveSummaryPdf(button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "保存中...";
  try {
    const ceremony = getActiveCeremony();
    const response = await apiFetch(`/api/report-pdf${ceremony ? `?ceremonyId=${ceremony.id}` : ""}`);
    if (!response.ok) throw new Error(`PDF download failed: ${response.status}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${getCeremonyName()}_集計表.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("PDF を保存できませんでした。", error);
    alert("PDF を保存できませんでした。もう一度お試しください。");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function renderSummaryPage() {
  const template = document.getElementById("summaryPageTemplate");
  const content = template.content.cloneNode(true);
  const pdfButton = content.querySelector("#summaryPdfButton");
  if (canEditAdmin()) {
    pdfButton.addEventListener("click", (event) => {
      saveSummaryPdf(event.currentTarget);
    });
  } else {
    pdfButton.disabled = true;
    pdfButton.classList.add("is-locked");
    pdfButton.title = "PDF 出力は管理者のみ利用できます";
    const note = document.createElement("span");
    note.className = "summary-pdf-note";
    note.textContent = "PDF 出力は管理者のみ利用できます";
    pdfButton.insertAdjacentElement("afterend", note);
  }
  const items = getActiveItems();
  content.querySelector("[data-summary-title]").textContent =
    `～${getCeremonyName()}　集計表～　報告数は累計数です`;
  content.querySelectorAll("[data-summary-colspan]").forEach((cell) => {
    cell.colSpan = items.length + 1;
  });
  content.querySelector("[data-phone-colspan]").colSpan = Math.max(1, items.length - 5);
  fillSummaryHeader(content.querySelector("#summaryHeaderRow"));

  const tbody = content.querySelector("tbody");
  const targetTotals = getTargetTotals();

  // 目標行
  const targetRow = document.createElement("tr");
  targetRow.className = "target-row";
  const targetLabel = document.createElement("th");
  targetLabel.textContent = "目標";
  targetRow.appendChild(targetLabel);
  for (const item of items) {
    const td = document.createElement("td");
    const value = getSummaryTargetValue(item.id, targetTotals[item.id]);
    if (canEditAdmin()) {
      const input = createNumberInput(value, async (raw) => {
        const v = Math.max(0, Number(raw) || 0);
        setLocalSummaryOverride(item.id, v);
        await postSummaryOverride(item.id, v);
      }, "target-input");
      td.appendChild(input);
      const unit = document.createElement("span");
      unit.className = "summary-unit";
      unit.textContent = item.unit;
      td.appendChild(unit);
    } else {
      td.innerHTML = `<span class="summary-value">${value || ""}</span><span class="summary-unit">${item.unit}</span>`;
    }
    targetRow.appendChild(td);
  }
  tbody.appendChild(targetRow);

  // 日次
  for (const date of getWeekDates()) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = date.label;
    tr.appendChild(th);
    const totals = getCumulativeDayTotals(date.id);
    for (const item of items) {
      const td = document.createElement("td");
      const value = totals?.[item.id] || "";
      td.innerHTML = `<span class="summary-value">${value}</span><span class="summary-unit">${item.unit}</span>`;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  // 最終
  const totalRow = content.querySelector("#weeklyTotalRow");
  const finalLabel = document.createElement("th");
  finalLabel.textContent = "最終";
  totalRow.appendChild(finalLabel);
  const final = getFinalTotals();
  for (const item of items) {
    const td = document.createElement("td");
    const value = final?.[item.id] || "";
    td.innerHTML = `<span class="summary-value">${value}</span><span class="summary-unit">${item.unit}</span>`;
    totalRow.appendChild(td);
  }

  pageContainer.innerHTML = "";
  pageContainer.appendChild(content);
}

function render() {
  renderTabs();
  appTitle.textContent = `${getActiveCeremony()?.name || "毎日集計"}毎日集計`;
  userStatus.textContent = getUserLabel();

  if (activeTab === "summary") {
    renderSummaryPage();
  } else if (activeTab === "admin") {
    if (!canViewAdmin()) {
      activeTab = state.user?.fellowship || fellowshipNames()[0] || "summary";
      render();
      return;
    }
    renderAdminPage();
  } else {
    renderInputPage(activeTab);
  }
}
