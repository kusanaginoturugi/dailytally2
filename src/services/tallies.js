export async function listTallies(db, ceremonyId) {
  const { results } = await db
    .prepare(
      `SELECT t.tally_item_id AS item_id, t.fellowship_id, t.tally_date, t.value
         FROM tallies t
        WHERE t.ceremony_id = ?`,
    )
    .bind(ceremonyId)
    .all();
  return results.map((row) => ({
    itemId: row.item_id,
    fellowshipId: row.fellowship_id,
    date: row.tally_date,
    value: row.value,
  }));
}

export async function getTallyValue(db, { ceremonyId, fellowshipId, itemId, date }) {
  const row = await db
    .prepare(
      `SELECT value FROM tallies
        WHERE ceremony_id = ? AND fellowship_id = ? AND tally_item_id = ? AND tally_date = ?`,
    )
    .bind(ceremonyId, fellowshipId, itemId, date)
    .first();
  return row ? row.value : 0;
}

export async function upsertTally(db, { ceremonyId, fellowshipId, itemId, date, value, updatedBy }) {
  await db
    .prepare(
      `INSERT INTO tallies (ceremony_id, tally_item_id, fellowship_id, tally_date, value, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
       ON CONFLICT(ceremony_id, tally_item_id, fellowship_id, tally_date)
       DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by`,
    )
    .bind(ceremonyId, itemId, fellowshipId, date, value, updatedBy || null)
    .run();
}

// 当該 (ceremony, fellowship, item) の date より前の日付のうち、最大の非ゼロ値を返す
export async function getPreviousCumulativeValue(db, { ceremonyId, fellowshipId, itemId, date }) {
  const row = await db
    .prepare(
      `SELECT MAX(value) AS prev FROM tallies
        WHERE ceremony_id = ? AND fellowship_id = ? AND tally_item_id = ?
          AND tally_date < ? AND value > 0`,
    )
    .bind(ceremonyId, fellowshipId, itemId, date)
    .first();
  return row?.prev || 0;
}
