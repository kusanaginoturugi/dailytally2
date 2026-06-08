-- 山梨伝道会の tendo_code は 31901 (伝道会番号.csv 参照)。
-- 初版 seed (0002) で NULL のまま投入されていたため修正。
UPDATE fellowships SET tendo_code = '31901' WHERE id = 9 AND name = '山梨' AND tendo_code IS NULL;
