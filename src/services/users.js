export async function listUsers(db) {
  const { results } = await db
    .prepare(
      `SELECT u.login_id, u.name, u.email, u.role, u.last_login_at, f.name AS fellowship
         FROM users u
         LEFT JOIN fellowships f ON f.id = u.fellowship_id
        ORDER BY u.login_id ASC`,
    )
    .all();
  return results.map((row) => ({
    loginId: row.login_id || "",
    name: row.name || "",
    email: row.email || "",
    role: row.role || "",
    fellowship: row.fellowship || "",
    lastLoginAt: row.last_login_at || "",
  }));
}

export async function replaceUsers(db, users) {
  await db.prepare("DELETE FROM users").run();
  const fellowships = await db.prepare("SELECT id, name FROM fellowships").all();
  const fellowshipIdByName = new Map(fellowships.results.map((row) => [row.name, row.id]));

  for (const user of users) {
    if (!user || !user.loginId) {
      continue;
    }
    await db
      .prepare(
        `INSERT INTO users (login_id, fellowship_id, name, email, role)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(login_id) DO UPDATE SET
           fellowship_id = excluded.fellowship_id,
           name = excluded.name,
           email = excluded.email,
           role = excluded.role`,
      )
      .bind(
        user.loginId,
        fellowshipIdByName.get(user.fellowship) || null,
        user.name || null,
        user.email || null,
        user.role || null,
      )
      .run();
  }
}

export async function recordLogin(db, user) {
  if (!user?.loginId) {
    return;
  }
  const fellowshipRow = user.fellowship
    ? await db.prepare("SELECT id FROM fellowships WHERE name = ?").bind(user.fellowship).first()
    : null;
  await db
    .prepare(
      `INSERT INTO users (login_id, fellowship_id, name, email, role, last_login_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(login_id) DO UPDATE SET
         fellowship_id = excluded.fellowship_id,
         name = excluded.name,
         email = excluded.email,
         role = excluded.role,
         last_login_at = CURRENT_TIMESTAMP`,
    )
    .bind(user.loginId, fellowshipRow?.id || null, user.name || null, user.email || null, user.role || null)
    .run();
}
