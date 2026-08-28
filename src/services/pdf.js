import puppeteer from "@cloudflare/puppeteer";
import { formatShortDate } from "../lib/dates.js";
import { listFellowships } from "./fellowships.js";
import { listCeremonyItems, getCeremony, ensureCeremonyDates } from "./ceremonies.js";
import { listTallies } from "./tallies.js";
import { listFellowshipTargets, listSummaryTargetOverrides } from "./targets.js";
import { buildSummary } from "./summary.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSummaryHeaderCell(item, ceremony) {
  if (item.key === "seekers") {
    const date = ceremony.seekersStartAt
      ? `<span class="horizontal-date">(${escapeHtml(formatShortDate(ceremony.seekersStartAt))}～)</span>`
      : "";
    return `得道者数${date}`;
  }
  if (item.key === "tenchi") return "この護摩供に<br>向けての<br>天地免劫護摩木";
  if (item.key === "goma") return "この護摩供に<br>向けての<br>各種護摩木";
  if (item.key === "water") {
    if (item.summaryName === "御神水・命泉・泉・龍華水・禄存五聖杯") return "御神水・命泉・<br>泉・龍華水・<br>禄存五聖杯";
    if (item.summaryName === "御神水・泉・龍華水等") return "御神水・泉・<br>龍華水等";
    if (item.summaryName === "御神水・命泉・泉・龍華水等") return "御神水・命泉・<br>泉・龍華水等";
    if (item.summaryName === "御神水・命泉・泉・龍華水") return "御神水・命泉・<br>泉・龍華水";
  }
  return escapeHtml(item.summaryName || item.name);
}

export async function buildSummaryReportHtml(db, ceremonyId, options = {}) {
  const ceremony = await ensureCeremonyDates(db, await getCeremony(db, ceremonyId));
  const [items, fellowships, tallies, fellowshipTargets, summaryOverrides] = await Promise.all([
    listCeremonyItems(db, ceremonyId),
    listFellowships(db),
    listTallies(db, ceremonyId),
    listFellowshipTargets(db, ceremonyId),
    listSummaryTargetOverrides(db, ceremonyId),
  ]);

  const summary = buildSummary({
    ceremony,
    items,
    fellowships,
    tallies,
    fellowshipTargets,
    summaryOverrides,
    today: options.reportDate,
  });
  const rows = [];

  rows.push(`
    <tr class="title-row">
      <th colspan="${items.length + 1}">～第${ceremony.nextNumber}回${escapeHtml(ceremony.name)}　集計表～　報告数は累計数です</th>
    </tr>
    <tr class="meta-row">
      <th colspan="3"><span class="meta-label">聖院名:</span><span class="meta-value">聖明王院</span></th>
      <th colspan="3" class="meta-person"><span class="meta-label">ご担当者名:</span><span class="meta-value">尾ノ上裕美</span></th>
      <th colspan="${Math.max(1, items.length - 5)}" class="meta-phone"><span class="meta-label">電話番号:</span><span class="meta-value">09041779036</span></th>
    </tr>
    <tr class="header-row">
      <th></th>
      ${items.map((item) => `<th>${renderSummaryHeaderCell(item, ceremony)}</th>`).join("")}
    </tr>
  `);

  rows.push(`
    <tr class="target-row">
      <th>目標</th>
      ${items
        .map((item) => {
          const value = summary.summaryTargetByItem[item.id] || "";
          return `<td><span class="value">${escapeHtml(value)}</span><span class="unit">${escapeHtml(item.unit)}</span></td>`;
        })
        .join("")}
    </tr>
  `);

  for (const { date, totals } of summary.dailyTotals) {
    rows.push(`
      <tr>
        <th>${escapeHtml(formatShortDate(date))}</th>
        ${items
          .map((item) => {
            const value = totals?.[item.id] || "";
            return `<td><span class="value">${escapeHtml(value)}</span><span class="unit">${escapeHtml(item.unit)}</span></td>`;
          })
          .join("")}
      </tr>
    `);
  }

  rows.push(`
    <tr class="final-row">
      <th>最終</th>
      ${items
        .map((item) => {
          const value = summary.finalTotals?.[item.id] || "";
          return `<td><span class="value">${escapeHtml(value)}</span><span class="unit">${escapeHtml(item.unit)}</span></td>`;
        })
        .join("")}
    </tr>
  `);

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4 landscape; }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; color: #000; background: #fff;
      font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif; }
    .pdf-page { width: 100%; height: 194mm; display: flex; flex-direction: column; }
    table { width: 100%; flex: 1 1 auto; border-collapse: collapse; table-layout: fixed; }
    th, td { position: relative; border: 1.5px solid #000; background: #fff; color: #000;
      height: 38px; padding: 3px 4px; text-align: center; vertical-align: middle;
      font-size: 14px; line-height: 1.2; }
    .title-row th { height: 34px; font-size: 22px; font-weight: 500; }
    .meta-row th { position: relative; height: 30px; padding: 2px 8px; text-align: center;
      font-size: 18px; font-weight: 400; }
    .meta-label { position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
      white-space: nowrap; z-index: 1; }
    .meta-value { position: absolute; inset: 2px 8px 2px 86px; display: flex;
      align-items: center; justify-content: center; }
    .meta-person .meta-value { left: 126px; }
    .meta-phone .meta-value { left: 104px; }
    .header-row th { width: 110px; min-width: 84px; height: 166px; padding: 8px 6px;
      vertical-align: middle; white-space: normal; font-size: 18px; font-weight: 400;
      line-height: 1.25; writing-mode: vertical-rl; text-orientation: mixed; }
    .header-row th:first-child { width: 64px; min-width: 64px; writing-mode: horizontal-tb; }
    .horizontal-date { display: inline-block; writing-mode: horizontal-tb;
      font-size: 14px; margin-top: 8px; }
    tr:not(.title-row):not(.meta-row):not(.header-row) th { width: 64px; min-width: 64px;
      height: 52px; padding: 4px 6px; text-align: center; font-size: 16px; font-weight: 400; }
    td { height: 52px; padding: 4px 7px; font-size: 18px; font-weight: 700; }
    .unit { position: absolute; right: 4px; bottom: 3px; font-size: 11px; font-weight: 400; }
    .note { margin: 0; border: 1.5px solid #000; border-top: 0; padding: 2px 6px;
      font-size: 14px; flex: 0 0 auto; }
  </style>
</head>
<body>
  <div class="pdf-page">
    <table>${rows.join("")}</table>
    <p class="note">※水は種類を問わず、箱数で記入(1箱20リットルとして計算願います)</p>
  </div>
</body>
</html>`;
}

export async function generateSummaryPdf(env, ceremonyId, options = {}) {
  if (!env.BROWSER) {
    throw new Error("BROWSER binding is not configured");
  }
  const html = await buildSummaryReportHtml(env.DB, ceremonyId, options);
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    });
  } finally {
    await browser.close();
  }
}
