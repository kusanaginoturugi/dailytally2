export async function listFellowshipTargets(db, ceremonyId) {
  const { results } = await db
    .prepare(
      `SELECT tally_item_id AS item_id, fellowship_id, value
         FROM fellowship_targets WHERE ceremony_id = ?`,
    )
    .bind(ceremonyId)
    .all();
  return results.map((row) => ({
    itemId: row.item_id,
    fellowshipId: row.fellowship_id,
    value: row.value,
  }));
}

export async function upsertFellowshipTarget(db, { ceremonyId, fellowshipId, itemId, value }) {
  await db
    .prepare(
      `INSERT INTO fellowship_targets (ceremony_id, tally_item_id, fellowship_id, value, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(ceremony_id, tally_item_id, fellowship_id)
       DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(ceremonyId, itemId, fellowshipId, value)
    .run();
}

export async function listSummaryTargetOverrides(db, ceremonyId) {
  const { results } = await db
    .prepare(
      `SELECT tally_item_id AS item_id, value FROM summary_target_overrides WHERE ceremony_id = ?`,
    )
    .bind(ceremonyId)
    .all();
  return results.map((row) => ({ itemId: row.item_id, value: row.value }));
}

export async function upsertSummaryTargetOverride(db, { ceremonyId, itemId, value }) {
  await db
    .prepare(
      `INSERT INTO summary_target_overrides (ceremony_id, tally_item_id, value, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(ceremony_id, tally_item_id)
       DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(ceremonyId, itemId, value)
    .run();
}
