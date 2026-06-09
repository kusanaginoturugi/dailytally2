export async function listFellowships(db) {
  const { results } = await db
    .prepare("SELECT id, name, tendo_code, sort_order FROM fellowships WHERE enabled = 1 ORDER BY sort_order ASC, id ASC")
    .all();
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    tendoCode: row.tendo_code || "",
    sortOrder: row.sort_order,
  }));
}

// 管理画面用: 全件 + enabled を返す。
export async function listAllFellowships(db) {
  const { results } = await db
    .prepare("SELECT id, name, tendo_code, sort_order, enabled FROM fellowships ORDER BY enabled DESC, sort_order ASC, id ASC")
    .all();
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    tendoCode: row.tendo_code || "",
    sortOrder: row.sort_order,
    enabled: row.enabled === 1,
  }));
}

export async function setFellowshipEnabled(db, id, enabled) {
  await db
    .prepare("UPDATE fellowships SET enabled = ? WHERE id = ?")
    .bind(enabled ? 1 : 0, id)
    .run();
}

export async function getFellowshipByName(db, name) {
  if (!name) {
    return null;
  }
  const row = await db.prepare("SELECT id, name FROM fellowships WHERE name = ?").bind(name).first();
  return row ? { id: row.id, name: row.name } : null;
}
