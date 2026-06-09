-- dailytally2.fellowships.id を osystem-masters.fellowships.id に揃える
-- 9 件の伝道会の id マッピング:
--   dailytally2 → master
--    1 大江戸   → 18
--    2 お台場   → 20
--    3 羽田     → 19
--    4 かながわ → 24
--    5 富士山   → 27
--    6 駿天     → 28
--    7 埼玉     → 15
--    8 千葉     → 16
--    9 山梨     → 25
--
-- sort_order は dailytally2 独自の業務順を維持する。
-- 以降はこの id が master と一致しているので、同期は INSERT OR REPLACE で素直に動く。

PRAGMA foreign_keys = OFF;

-- 1. tallies.fellowship_id を master id に書き換え
UPDATE tallies SET fellowship_id = 18 WHERE fellowship_id = 1;
UPDATE tallies SET fellowship_id = 20 WHERE fellowship_id = 2;
UPDATE tallies SET fellowship_id = 19 WHERE fellowship_id = 3;
UPDATE tallies SET fellowship_id = 24 WHERE fellowship_id = 4;
UPDATE tallies SET fellowship_id = 27 WHERE fellowship_id = 5;
UPDATE tallies SET fellowship_id = 28 WHERE fellowship_id = 6;
UPDATE tallies SET fellowship_id = 15 WHERE fellowship_id = 7;
UPDATE tallies SET fellowship_id = 16 WHERE fellowship_id = 8;
UPDATE tallies SET fellowship_id = 25 WHERE fellowship_id = 9;

-- 2. fellowship_targets.fellowship_id を master id に書き換え
UPDATE fellowship_targets SET fellowship_id = 18 WHERE fellowship_id = 1;
UPDATE fellowship_targets SET fellowship_id = 20 WHERE fellowship_id = 2;
UPDATE fellowship_targets SET fellowship_id = 19 WHERE fellowship_id = 3;
UPDATE fellowship_targets SET fellowship_id = 24 WHERE fellowship_id = 4;
UPDATE fellowship_targets SET fellowship_id = 27 WHERE fellowship_id = 5;
UPDATE fellowship_targets SET fellowship_id = 28 WHERE fellowship_id = 6;
UPDATE fellowship_targets SET fellowship_id = 15 WHERE fellowship_id = 7;
UPDATE fellowship_targets SET fellowship_id = 16 WHERE fellowship_id = 8;
UPDATE fellowship_targets SET fellowship_id = 25 WHERE fellowship_id = 9;

-- 3. fellowships を作り直し (master id、sort_order は元の業務順を維持)
DELETE FROM fellowships;
INSERT INTO fellowships (id, name, tendo_code, sort_order) VALUES
  (18, '大江戸',   '31303', 1),
  (20, 'お台場',   '31305', 2),
  (19, '羽田',     '31304', 3),
  (24, 'かながわ', '31407', 4),
  (27, '富士山',   '32204', 5),
  (28, '駿天',     '32205', 6),
  (15, '埼玉',     '31101', 7),
  (16, '千葉',     '31201', 8),
  (25, '山梨',     '31901', 9);

PRAGMA foreign_keys = ON;
