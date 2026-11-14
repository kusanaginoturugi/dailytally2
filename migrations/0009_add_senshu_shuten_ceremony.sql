-- 第15回 泉珠収天護摩供。個別集計日と最終日を登録する。
CREATE TABLE ceremony_tally_dates (
  ceremony_id INTEGER NOT NULL REFERENCES ceremonies(id) ON DELETE CASCADE,
  tally_date  TEXT NOT NULL,
  is_final    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ceremony_id, tally_date)
);

INSERT INTO ceremonies (
  id, name, next_number, begin_at, end_at, seekers_start_at, sort_order
) VALUES (
  10, '泉珠収天護摩供', 15, '2026-11-15', '2027-03-21', '2026-11-15', 10
);

INSERT INTO tally_items (ceremony_id, item_key, name, summary_name, unit, sort_order) VALUES
  (10, 'tenchi',       '天地免劫護摩木',       '天地免劫護摩木',       '本', 1),
  (10, 'senshu_goma',  '泉珠収天護摩木他',     '泉珠収天護摩木他',     '本', 2),
  (10, 'ryuge',        '三會龍華之御柱',       '三會龍華之御柱',       '本', 3),
  (10, 'sanki',        '三期滅劫之霊木',       '三期滅劫之霊木',       '本', 4),
  (10, 'lecturer',     '講道師数',             '講道師数',             '人', 5),
  (10, 'altar',        '開壇数',               '開壇数',               '壇', 6),
  (10, 'ancestral',    '合同祖霊超抜霊数',     '合同祖霊超抜霊数',     '霊', 7),
  (10, 'seekers',      '得道者数',             '得道者数',             '人', 8),
  (10, 'participants', '参加人数',             '参加人数',             '人', 9);

INSERT INTO ceremony_tally_dates (ceremony_id, tally_date, is_final) VALUES
  (10, '2026-11-15', 0),
  (10, '2026-12-15', 0),
  (10, '2027-01-15', 0),
  (10, '2027-02-15', 0),
  (10, '2027-03-05', 0),
  (10, '2027-03-14', 0),
  (10, '2027-03-15', 0),
  (10, '2027-03-16', 0),
  (10, '2027-03-17', 0),
  (10, '2027-03-18', 0),
  (10, '2027-03-19', 0),
  (10, '2027-03-20', 0),
  (10, '2027-03-21', 1);
