export async function listFellowships(db) {
  const { results } = await db
    .prepare("SELECT id, name, tendo_code, sort_order FROM fellowships ORDER BY sort_order ASC, id ASC")
    .all();
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    tendoCode: row.tendo_code || "",
    sortOrder: row.sort_order,
  }));
}

export async function getFellowshipByName(db, name) {
  if (!name) {
    return null;
  }
  const row = await db.prepare("SELECT id, name FROM fellowships WHERE name = ?").bind(name).first();
  return row ? { id: row.id, name: row.name } : null;
}
