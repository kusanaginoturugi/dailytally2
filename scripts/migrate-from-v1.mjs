#!/usr/bin/env node
// 旧 Dailytally の app_state(data JSON) を dailytally2 スキーマに変換する。
//
// 使い方:
//   1) 旧 D1 から JSON を取り出す
//      npx wrangler d1 execute dailytally --remote \
//        --command "SELECT data FROM app_state WHERE id='main'" --json > legacy.json
//   2) このスクリプトで SQL を生成
//      node scripts/migrate-from-v1.mjs --in legacy.json --out migration.sql
//   3) 新 D1 に適用
//      npx wrangler d1 execute dailytally2 --remote --file migration.sql
//
// シードで作成した ceremony id 順序 (sort_order = id 1..9) に依存。

import fs from "node:fs";

const CEREMONY_SLUG_TO_ID = {
  "hachidai-myo-o": 1,
  "daigen-chiku": 2,
  "jizo-sonno": 3,
  "segaki-kuyo": 4,
  "hokuto-chinatsu": 5,
  "rokuson-hoju": 6,
  "chosei-minami": 7,
  "myozen-enma": 8,
  "chinkon-shikai": 9,
};

function parseArgs(argv) {
  const args = { in: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--in") args.in = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg.startsWith("--in=")) args.in = arg.slice(5);
    else if (arg.startsWith("--out=")) args.out = arg.slice(6);
  }
  if (!args.in) {
    console.error("Usage: migrate-from-v1.mjs --in <legacy.json> [--out <migration.sql>]");
    process.exit(1);
  }
  return args;
}

function loadLegacyState(inputPath) {
  const raw = fs.readFileSync(inputPath, "utf8");
  const parsed = JSON.parse(raw);
  const candidates = [];
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (entry?.results) candidates.push(...entry.results);
    }
  } else if (parsed?.results) {
    candidates.push(...parsed.results);
  } else if (parsed?.data) {
    candidates.push(parsed);
  } else {
    candidates.push(parsed);
  }
  const row = candidates.find((c) => c?.data);
  if (!row) {
    throw new Error("legacy data row (with 'data' field) not found in input");
  }
  return typeof row.data === "string" ? JSON.parse(row.data) : row.data;
}

function sqlStr(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : "0";
}

function sqlBool(value) {
  return value ? "1" : "0";
}

function generate(state) {
  const lines = [];

  // active ceremony
  const activeSlug = state.settings?.ceremonyId;
  const activeId = CEREMONY_SLUG_TO_ID[activeSlug] || 1;
  lines.push(
    `INSERT INTO app_settings (key, value) VALUES ('active_ceremony_id', ${sqlStr(String(activeId))})`,
    `  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;`,
  );
  lines.push("");

  // ceremonies の期間
  for (const [slug, ceremonyId] of Object.entries(CEREMONY_SLUG_TO_ID)) {
    const data = state.ceremonyData?.[slug];
    if (!data) continue;
    lines.push(
      `UPDATE ceremonies SET begin_at = ${sqlStr(data.weekStart)}, end_at = ${sqlStr(data.weekEnd)}, ` +
        `seekers_start_at = ${sqlStr(data.seekerStart)}, date_preset_key = ${sqlStr(data.datePresetKey)} ` +
        `WHERE id = ${ceremonyId};`,
    );
  }
  lines.push("");

  // tallies / fellowship_targets / summary_target_overrides
  for (const [slug, ceremonyId] of Object.entries(CEREMONY_SLUG_TO_ID)) {
    const data = state.ceremonyData?.[slug];
    if (!data) continue;
    const finalDateRaw = data.weekEnd;

    // tallies
    for (const [fellowshipName, days] of Object.entries(data.fellowships || {})) {
      for (const [rawDate, items] of Object.entries(days || {})) {
        const date = rawDate === "__final__" ? finalDateRaw : rawDate;
        if (!date) continue;
        for (const [itemKey, rawValue] of Object.entries(items || {})) {
          const value = Number(rawValue) || 0;
          if (!value) continue;
          lines.push(
            `INSERT INTO tallies (ceremony_id, tally_item_id, fellowship_id, tally_date, value) ` +
              `SELECT ${ceremonyId}, ` +
              `(SELECT id FROM tally_items WHERE ceremony_id = ${ceremonyId} AND item_key = ${sqlStr(itemKey)}), ` +
              `(SELECT id FROM fellowships WHERE name = ${sqlStr(fellowshipName)}), ` +
              `${sqlStr(date)}, ${sqlNum(value)} ` +
              `WHERE EXISTS (SELECT 1 FROM tally_items WHERE ceremony_id = ${ceremonyId} AND item_key = ${sqlStr(itemKey)}) ` +
              `  AND EXISTS (SELECT 1 FROM fellowships WHERE name = ${sqlStr(fellowshipName)}) ` +
              `ON CONFLICT(ceremony_id, tally_item_id, fellowship_id, tally_date) ` +
              `DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;`,
          );
        }
      }
    }

    // fellowship_targets
    for (const [fellowshipName, items] of Object.entries(data.fellowshipTargets || {})) {
      for (const [itemKey, rawValue] of Object.entries(items || {})) {
        const value = Number(rawValue) || 0;
        if (!value) continue;
        lines.push(
          `INSERT INTO fellowship_targets (ceremony_id, tally_item_id, fellowship_id, value) ` +
            `SELECT ${ceremonyId}, ` +
            `(SELECT id FROM tally_items WHERE ceremony_id = ${ceremonyId} AND item_key = ${sqlStr(itemKey)}), ` +
            `(SELECT id FROM fellowships WHERE name = ${sqlStr(fellowshipName)}), ` +
            `${sqlNum(value)} ` +
            `WHERE EXISTS (SELECT 1 FROM tally_items WHERE ceremony_id = ${ceremonyId} AND item_key = ${sqlStr(itemKey)}) ` +
            `  AND EXISTS (SELECT 1 FROM fellowships WHERE name = ${sqlStr(fellowshipName)}) ` +
            `ON CONFLICT(ceremony_id, tally_item_id, fellowship_id) ` +
            `DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;`,
        );
      }
    }

    // summary_target_overrides
    for (const [itemKey, rawValue] of Object.entries(data.summaryTargetOverrides || {})) {
      const value = Number(rawValue) || 0;
      lines.push(
        `INSERT INTO summary_target_overrides (ceremony_id, tally_item_id, value) ` +
          `SELECT ${ceremonyId}, ` +
          `(SELECT id FROM tally_items WHERE ceremony_id = ${ceremonyId} AND item_key = ${sqlStr(itemKey)}), ` +
          `${sqlNum(value)} ` +
          `WHERE EXISTS (SELECT 1 FROM tally_items WHERE ceremony_id = ${ceremonyId} AND item_key = ${sqlStr(itemKey)}) ` +
          `ON CONFLICT(ceremony_id, tally_item_id) ` +
          `DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;`,
      );
    }
  }
  lines.push("");

  // users
  for (const user of state.users || []) {
    if (!user?.loginId) continue;
    lines.push(
      `INSERT INTO users (login_id, fellowship_id, name, email, role) ` +
        `SELECT ${sqlStr(user.loginId)}, ` +
        `${user.fellowship ? `(SELECT id FROM fellowships WHERE name = ${sqlStr(user.fellowship)})` : "NULL"}, ` +
        `${sqlStr(user.name)}, ${sqlStr(user.email)}, ${sqlStr(user.role)} ` +
        `ON CONFLICT(login_id) DO UPDATE SET ` +
        `fellowship_id = excluded.fellowship_id, name = excluded.name, email = excluded.email, role = excluded.role;`,
    );
  }
  lines.push("");

  // report_settings
  const r = state.reportAutomation || {};
  lines.push(
    `UPDATE report_settings SET ` +
      `enabled = ${sqlBool(r.enabled)}, ` +
      `send_time = ${sqlStr(r.sendTime || "22:00")}, ` +
      `sender_name = ${sqlStr(r.senderName)}, ` +
      `branch_name = ${sqlStr(r.branchName)}, ` +
      `branch_code = ${sqlStr(r.branchCode)}, ` +
      `notify_email = ${sqlStr(r.notifyEmail)}, ` +
      `last_attempt_at = ${sqlStr(r.lastAttemptAt)}, ` +
      `last_attempt_key = ${sqlStr(r.lastAttemptKey)}, ` +
      `last_success_at = ${sqlStr(r.lastSuccessAt)}, ` +
      `last_sent_key = ${sqlStr(r.lastSentKey)}, ` +
      `last_error = ${sqlStr(r.lastError)}, ` +
      `updated_at = CURRENT_TIMESTAMP ` +
      `WHERE id = 1;`,
  );
  lines.push("");

  // report_history (旧は新しい順なので逆順に INSERT して id 順を保つ)
  const history = Array.isArray(r.history) ? [...r.history].reverse() : [];
  for (const entry of history) {
    lines.push(
      `INSERT INTO report_history (sent_at, send_key, status, message, ceremony_id) ` +
        `VALUES (${sqlStr(entry.at)}, ${sqlStr(entry.key)}, ${sqlStr(entry.status)}, ${sqlStr(entry.message)}, ${activeId});`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const legacy = loadLegacyState(args.in);
  const sql = generate(legacy);
  if (args.out) {
    fs.writeFileSync(args.out, `${sql}\n`);
    console.error(`wrote ${args.out}`);
  } else {
    process.stdout.write(`${sql}\n`);
  }
}

main();
