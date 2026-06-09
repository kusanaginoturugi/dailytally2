// osystem-masters から fellowships を取り込む同期処理。
// dailytally2.fellowships.id は migration 0005 で master と揃えてあるため、
// ここでは INSERT OR REPLACE で素直に上書きする。

async function fetchMasterFellowships(env) {
  if (!env.MASTERS_URL) {
    throw new Error("MASTERS_URL is not configured");
  }
  const base = env.MASTERS_URL.replace(/\/+$/, "");
  const response = await fetch(`${base}/api/fellowships`);
  if (!response.ok) {
    throw new Error(`masters /api/fellowships returned ${response.status}`);
  }
  const body = await response.json();
  if (!Array.isArray(body.data)) {
    throw new Error("masters response missing data array");
  }
  return body;
}

export async function syncFellowships(env) {
  const { data, updated_at: updatedAt } = await fetchMasterFellowships(env);

  // master.short_name → dailytally2.name、master.code → dailytally2.tendo_code として取り込む。
  // dailytally2.sort_order は業務上の並び順を残したいので、新規レコード以外は触らない。
  const existing = await env.DB.prepare("SELECT id, sort_order FROM fellowships").all();
  const existingSort = new Map(existing.results.map((row) => [row.id, row.sort_order]));
  const maxSort = existing.results.reduce((acc, row) => Math.max(acc, row.sort_order || 0), 0);

  let nextNewSort = maxSort + 1;
  const statements = data.map((row) => {
    const sortOrder = existingSort.has(row.id) ? existingSort.get(row.id) : nextNewSort++;
    return env.DB
      .prepare(
        `INSERT INTO fellowships (id, name, tendo_code, sort_order)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           tendo_code = excluded.tendo_code`,
      )
      .bind(row.id, row.short_name, row.code, sortOrder);
  });

  await env.DB.batch(statements);

  return {
    count: data.length,
    masterUpdatedAt: updatedAt,
  };
}
