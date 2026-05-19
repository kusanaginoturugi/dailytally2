import { formatJSTTimestamp, nowJST } from "../lib/dates.js";

function rowToReportSettings(row) {
  return {
    enabled: Boolean(row.enabled),
    sendTime: row.send_time || "22:00",
    senderName: row.sender_name || "",
    branchName: row.branch_name || "",
    branchCode: row.branch_code || "",
    notifyEmail: row.notify_email || "",
    lastAttemptAt: row.last_attempt_at || "",
    lastAttemptKey: row.last_attempt_key || "",
    lastSuccessAt: row.last_success_at || "",
    lastSentKey: row.last_sent_key || "",
    lastError: row.last_error || "",
    updatedAt: row.updated_at || "",
  };
}

export async function getReportSettings(db) {
  const row = await db.prepare("SELECT * FROM report_settings WHERE id = 1").first();
  if (!row) {
    return rowToReportSettings({
      enabled: 0,
      send_time: "22:00",
      sender_name: "",
      branch_name: "",
      branch_code: "",
      notify_email: "",
    });
  }
  return rowToReportSettings(row);
}

export async function updateReportSettings(db, fields) {
  await db
    .prepare(
      `UPDATE report_settings
          SET enabled = ?, send_time = ?, sender_name = ?, branch_name = ?, branch_code = ?, notify_email = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`,
    )
    .bind(
      fields.enabled ? 1 : 0,
      fields.sendTime || "22:00",
      fields.senderName || "",
      fields.branchName || "",
      fields.branchCode || "",
      fields.notifyEmail || "",
    )
    .run();
}

export async function updateReportAttempt(db, { lastAttemptAt, lastAttemptKey, lastError }) {
  await db
    .prepare(
      `UPDATE report_settings
          SET last_attempt_at = ?, last_attempt_key = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`,
    )
    .bind(lastAttemptAt || "", lastAttemptKey || "", lastError || "")
    .run();
}

export async function updateReportSuccess(db, { lastSuccessAt, lastSentKey }) {
  await db
    .prepare(
      `UPDATE report_settings
          SET last_success_at = ?, last_sent_key = ?, last_error = '', updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`,
    )
    .bind(lastSuccessAt || "", lastSentKey || "")
    .run();
}

export async function updateReportError(db, errorMessage) {
  await db
    .prepare(
      `UPDATE report_settings SET last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
    )
    .bind(errorMessage || "")
    .run();
}

export async function appendReportHistory(db, { sentAt, sendKey, status, message, ceremonyId }) {
  await db
    .prepare(
      `INSERT INTO report_history (sent_at, send_key, status, message, ceremony_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(sentAt || formatJSTTimestamp(), sendKey || null, status || null, message || null, ceremonyId || null)
    .run();
}

export async function listReportHistory(db, limit = 20) {
  const { results } = await db
    .prepare(
      `SELECT sent_at, send_key, status, message, ceremony_id
         FROM report_history ORDER BY id DESC LIMIT ?`,
    )
    .bind(limit)
    .all();
  return results.map((row) => ({
    at: row.sent_at,
    key: row.send_key || "",
    status: row.status || "",
    message: row.message || "",
    ceremonyId: row.ceremony_id || null,
  }));
}

export function buildSendKey(ceremonyId, date, sendTime) {
  return `${ceremonyId}:${date}:${sendTime}`;
}

export function isReportDue(settings, ceremony, date = new Date()) {
  if (!settings.enabled || !/^\d{2}:\d{2}$/.test(settings.sendTime || "")) {
    return false;
  }
  if (!ceremony?.beginAt || !ceremony?.endAt) {
    return false;
  }
  const [hour, minute] = settings.sendTime.split(":").map(Number);
  const jst = nowJST(date);
  const today = jst.toISOString().slice(0, 10);
  const currentMinutes = jst.getUTCHours() * 60 + jst.getUTCMinutes();
  const targetMinutes = hour * 60 + minute;

  if (today < ceremony.beginAt || today > ceremony.endAt) {
    return false;
  }
  if (currentMinutes < targetMinutes) {
    return false;
  }
  const sendKey = buildSendKey(ceremony.id, today, settings.sendTime);
  return settings.lastSentKey !== sendKey && settings.lastAttemptKey !== sendKey;
}
