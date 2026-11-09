-- 入力済みの第15回泉珠収天護摩供の各伝道会目標を固定する。
-- 固定後は管理者を含め、誰も変更・削除できない。
ALTER TABLE ceremonies ADD COLUMN targets_locked_at TEXT;

UPDATE ceremonies
   SET targets_locked_at = CURRENT_TIMESTAMP
 WHERE id = 10;
