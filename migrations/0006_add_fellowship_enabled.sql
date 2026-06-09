-- fellowships に enabled フラグを追加し、業務で使う 9 件だけ既定で有効にする。
-- 以降の同期では新規取り込みは enabled = 0 で入る (DEFAULT)。
-- 業務側の有効/無効は dailytally2 の管理画面でトグルする (master 側は触らない)。

ALTER TABLE fellowships ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0;

UPDATE fellowships SET enabled = 1
WHERE id IN (15, 16, 18, 19, 20, 24, 25, 27, 28);
