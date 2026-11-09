-- 入力済みの第15回泉珠収天護摩供の各伝道会目標を固定する。
-- 管理者は引き続き編集でき、各伝道会からの変更だけを禁止する。
ALTER TABLE ceremonies ADD COLUMN targets_locked_at TEXT;

UPDATE ceremonies
   SET targets_locked_at = CURRENT_TIMESTAMP
 WHERE id = 10;
