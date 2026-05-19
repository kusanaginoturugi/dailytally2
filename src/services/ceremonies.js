import { addDaysISO, isValidISODate, todayISO } from "../lib/dates.js";

// ceremony_id → date preset (seed の sort_order = ceremony.id と一致)
const CEREMONY_DATE_PRESETS = {
  3: { endMonth: 6, endDay: 20 },
  4: { endMonth: 8, endDay: 9 },
  5: { endMonth: 9, endDay: 13 },
  6: { endMonth: 10, endDay: 11 },
  7: { endMonth: 11, endDay: 8 },
  8: { endMonth: 11, endDay: 23 },
};

export function getCeremonyDatePreset(ceremonyId) {
  const preset = CEREMONY_DATE_PRESETS[ceremonyId];
  if (!preset) {
    return null;
  }
  const year = Number(todayISO().slice(0, 4));
  const endAt = `${year}-${String(preset.endMonth).padStart(2, "0")}-${String(preset.endDay).padStart(2, "0")}`;
  return {
    key: `${year}-${ceremonyId}-${preset.endMonth}-${preset.endDay}`,
    beginAt: addDaysISO(endAt, -7),
    endAt,
  };
}

function rowToCeremony(row) {
  return {
    id: row.id,
    name: row.name,
    nextNumber: row.next_number,
    beginAt: row.begin_at || "",
    endAt: row.end_at || "",
    seekersStartAt: row.seekers_start_at || "",
    datePresetKey: row.date_preset_key || "",
    sortOrder: row.sort_order,
  };
}

export async function listCeremonies(db) {
  const { results } = await db
    .prepare("SELECT * FROM ceremonies ORDER BY sort_order ASC, id ASC")
    .all();
  return results.map(rowToCeremony);
}

export async function getCeremony(db, ceremonyId) {
  const row = await db.prepare("SELECT * FROM ceremonies WHERE id = ?").bind(ceremonyId).first();
  return row ? rowToCeremony(row) : null;
}

export async function listCeremonyItems(db, ceremonyId) {
  const { results } = await db
    .prepare("SELECT * FROM tally_items WHERE ceremony_id = ? ORDER BY sort_order ASC, id ASC")
    .bind(ceremonyId)
    .all();
  return results.map((row) => ({
    id: row.id,
    ceremonyId: row.ceremony_id,
    key: row.item_key,
    name: row.name,
    summaryName: row.summary_name,
    unit: row.unit,
    sortOrder: row.sort_order,
  }));
}

export async function listAllItemsByCeremony(db) {
  const { results } = await db
    .prepare("SELECT * FROM tally_items ORDER BY ceremony_id ASC, sort_order ASC, id ASC")
    .all();
  const byCeremony = new Map();
  for (const row of results) {
    if (!byCeremony.has(row.ceremony_id)) {
      byCeremony.set(row.ceremony_id, []);
    }
    byCeremony.get(row.ceremony_id).push({
      id: row.id,
      ceremonyId: row.ceremony_id,
      key: row.item_key,
      name: row.name,
      summaryName: row.summary_name,
      unit: row.unit,
      sortOrder: row.sort_order,
    });
  }
  return byCeremony;
}

export async function getActiveCeremonyId(db) {
  const row = await db
    .prepare("SELECT value FROM app_settings WHERE key = 'active_ceremony_id'")
    .first();
  return row ? Number(row.value) : null;
}

export async function setActiveCeremonyId(db, ceremonyId) {
  await db
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('active_ceremony_id', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(String(ceremonyId))
    .run();
}

export async function updateCeremonyDates(db, ceremonyId, { beginAt, endAt, seekersStartAt, datePresetKey }) {
  await db
    .prepare(
      `UPDATE ceremonies
         SET begin_at = ?, end_at = ?, seekers_start_at = ?, date_preset_key = ?
       WHERE id = ?`,
    )
    .bind(beginAt || null, endAt || null, seekersStartAt || null, datePresetKey || null, ceremonyId)
    .run();
}

// 期間が未設定/年違いなら自動補完して DB に書き戻す
export async function ensureCeremonyDates(db, ceremony) {
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));
  const preset = getCeremonyDatePreset(ceremony.id);
  const next = { ...ceremony };

  if (
    preset &&
    next.datePresetKey !== `custom:${preset.key}` &&
    (next.datePresetKey !== preset.key || next.beginAt !== preset.beginAt || next.endAt !== preset.endAt)
  ) {
    next.beginAt = preset.beginAt;
    next.endAt = preset.endAt;
    next.datePresetKey = preset.key;
  } else {
    if (!isValidISODate(next.beginAt) || Number(next.beginAt.slice(0, 4)) < currentYear) {
      next.beginAt = today;
    }
    if (!isValidISODate(next.endAt) || Number(next.endAt.slice(0, 4)) < currentYear) {
      next.endAt = addDaysISO(next.beginAt, 7);
    }
    if (next.endAt < next.beginAt) {
      next.endAt = addDaysISO(next.beginAt, 7);
    }
  }

  if (
    next.beginAt !== ceremony.beginAt ||
    next.endAt !== ceremony.endAt ||
    next.datePresetKey !== ceremony.datePresetKey
  ) {
    await updateCeremonyDates(db, ceremony.id, {
      beginAt: next.beginAt,
      endAt: next.endAt,
      seekersStartAt: next.seekersStartAt,
      datePresetKey: next.datePresetKey,
    });
  }
  return next;
}
