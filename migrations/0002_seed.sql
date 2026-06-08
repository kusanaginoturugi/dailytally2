-- dailytally2 seed data

-- 伝道会
INSERT INTO fellowships (id, name, tendo_code, sort_order) VALUES
  (1, '大江戸',   '31303', 1),
  (2, 'お台場',   '31305', 2),
  (3, '羽田',     '31304', 3),
  (4, 'かながわ', '31407', 4),
  (5, '富士山',   '32204', 5),
  (6, '駿天',     '32205', 6),
  (7, '埼玉',     '31101', 7),
  (8, '千葉',     '31201', 8),
  (9, '山梨',     '31901', 9);

-- 護摩供
INSERT INTO ceremonies (id, name, next_number, seekers_start_at, sort_order) VALUES
  (1, '八大明王護摩供',     31, '2026-04-28', 1),
  (2, '大元地空護摩供',     25, NULL,         2),
  (3, '地蔵尊王護摩供',     30, NULL,         3),
  (4, '施餓鬼供養護摩供',   31, NULL,         4),
  (5, '北斗鎮圧護摩供',     30, NULL,         5),
  (6, '禄存宝珠護摩供',     41, NULL,         6),
  (7, '長生南十字星護摩供', 30, NULL,         7),
  (8, '妙善閻魔天王護摩供', 24, NULL,         8),
  (9, '鎮魂四海龍王護摩供', 30, NULL,         9);

-- 集計項目 (護摩供別)
-- ceremony_id=1 八大明王護摩供
INSERT INTO tally_items (ceremony_id, item_key, name, summary_name, unit, sort_order) VALUES
  (1, 'seekers',  '得道者数',             '得道者数',                       '人', 1),
  (1, 'tenchi',   '天地免劫護摩木',       'この護摩供に向けての天地免劫護摩木', '本', 2),
  (1, 'goma',     '各種護摩木',           'この護摩供に向けての各種護摩木',     '本', 3),
  (1, 'nyoi',     '如意棒',               '八大明王如意棒',                 '本', 4),
  (1, 'sanki',    '三期滅劫霊木',         '三期滅劫之霊木',                 '本', 5),
  (1, 'ryuge',    '三會龍華之御柱',       '三會龍華之御柱',                 '本', 6),
  (1, 'fuda',     '八大明王札',           '八大明王札',                     '体', 7),
  (1, 'zaitama',  '明王招財玉',           '明王招財玉',                     '組', 8),
  (1, 'symbols',  '各種符',               '各種符',                         '枚', 9),
  (1, 'water',    '御神水・泉・龍華水等', '御神水・泉・龍華水等',           '箱', 10);

-- ceremony_id=2 大元地空護摩供
INSERT INTO tally_items (ceremony_id, item_key, name, summary_name, unit, sort_order) VALUES
  (2, 'seekers',     '得道者数',                 '得道者数',                       '人', 1),
  (2, 'tenchi',      '天地免劫護摩木',           'この護摩供に向けての天地免劫護摩木', '本', 2),
  (2, 'goma',        '各種護摩木',               'この護摩供に向けての各種護摩木',     '本', 3),
  (2, 'sanki_proxy', '三期滅劫之霊木代理奉納',   '三期滅劫之霊木代理奉納',         '本', 4),
  (2, 'ryuge_proxy', '三會龍華之御柱代理奉納',   '三會龍華之御柱代理奉納',         '本', 5),
  (2, 'senju',       '千手の御手',               '千手の御手',                     '枚', 6),
  (2, 'daigen_fuda', '大元地空札',               '大元地空札',                     '体', 7),
  (2, 'symbols',     '各種符',                   '各種符',                         '枚', 8),
  (2, 'water',       '御神水他・龍華水',         '御神水他・龍華水',               '箱', 9);

-- ceremony_id=3 地蔵尊王護摩供
INSERT INTO tally_items (ceremony_id, item_key, name, summary_name, unit, sort_order) VALUES
  (3, 'seekers',   '得道者数',                 '得道者数',                       '人', 1),
  (3, 'tenchi',    '天地免劫護摩木',           'この護摩供に向けての天地免劫護摩木', '本', 2),
  (3, 'goma',      '各種護摩木',               'この護摩供に向けての各種護摩木',     '本', 3),
  (3, 'sanki',     '三期滅劫之霊木',           '三期滅劫之霊木',                 '本', 4),
  (3, 'ryuge',     '三會龍華之御柱',           '三會龍華之御柱',                 '本', 5),
  (3, 'mizuko',    '水子萬灯會',               '水子萬灯會',                     '本', 6),
  (3, 'jizo_fuda', '地蔵古佛札',               '地蔵古佛札',                     '体', 7),
  (3, 'mayudama',  'まゆ玉',                   'まゆ玉',                         '個', 8),
  (3, 'symbols',   '各種符',                   '各種符',                         '枚', 9),
  (3, 'water',     '御神水・命泉・泉・龍華水', '御神水・命泉・泉・龍華水',       '箱', 10);

-- ceremony_id=4 施餓鬼供養護摩供
INSERT INTO tally_items (ceremony_id, item_key, name, summary_name, unit, sort_order) VALUES
  (4, 'seekers',        '得道者数',                       '得道者数',                       '人', 1),
  (4, 'tenchi',         '天地免劫護摩木',                 'この護摩供に向けての天地免劫護摩木', '本', 2),
  (4, 'goma',           '各種護摩木',                     'この護摩供に向けての各種護摩木',     '本', 3),
  (4, 'hokuto_segaki',  '北斗施餓鬼供養護摩木代理奉納',   '北斗施餓鬼供養護摩木代理奉納',   '本', 4),
  (4, 'sanki_proxy',    '三期滅劫之霊木代理奉納',         '三期滅劫之霊木代理奉納',         '本', 5),
  (4, 'ryuge_proxy',    '三會龍華之御柱代理奉納',         '三會龍華之御柱代理奉納',         '本', 6),
  (4, 'segaki_ita',     '施餓鬼板',                       '施餓鬼板',                       '枚', 7),
  (4, 'symbols',        '各種符',                         '各種符',                         '枚', 8),
  (4, 'water',          '御神水・命泉・泉・龍華水',       '御神水・命泉・泉・龍華水',       '箱', 9);

-- ceremony_id=5 北斗鎮圧護摩供
INSERT INTO tally_items (ceremony_id, item_key, name, summary_name, unit, sort_order) VALUES
  (5, 'seekers',     '得道者数',                          '得道者数',                       '人', 1),
  (5, 'tenchi',      '天地免劫護摩木',                    'この護摩供に向けての天地免劫護摩木', '本', 2),
  (5, 'goma',        '各種護摩木',                        'この護摩供に向けての各種護摩木',     '本', 3),
  (5, 'sanki_proxy', '三期滅劫之霊木代理奉納',            '三期滅劫之霊木代理奉納',         '本', 4),
  (5, 'ryuge_proxy', '三會龍華之御柱代理奉納',            '三會龍華之御柱代理奉納',         '本', 5),
  (5, 'inau',        'イナウ・なで玄武・北斗鎮圧札',      'イナウ・なで玄武・北斗鎮圧札',   'ケ', 6),
  (5, 'symbols',     '各種符',                            '各種符',                         '枚', 7),
  (5, 'water',       '御神水・命泉・泉・龍華水',          '御神水・命泉・泉・龍華水',       '箱', 8);

-- ceremony_id=6 禄存宝珠護摩供
INSERT INTO tally_items (ceremony_id, item_key, name, summary_name, unit, sort_order) VALUES
  (6, 'seekers',      '得道者数',                          '得道者数',                            '人', 1),
  (6, 'tenchi',       '天地免劫護摩木',                    'この護摩供に向けての天地免劫護摩木',  '本', 2),
  (6, 'goma',         '各種護摩木',                        'この護摩供に向けての各種護摩木',      '本', 3),
  (6, 'sanki_proxy',  '三期滅劫之霊木代理奉納',            '三期滅劫之霊木代理奉納',              '本', 4),
  (6, 'ryuge_proxy',  '三會龍華之御柱代理奉納',            '三會龍華之御柱代理奉納',              '本', 5),
  (6, 'senju',        '千手の御手',                        '千手の御手',                          '枚', 6),
  (6, 'junishinsho',  '十二神将板・龍樹滅業棒',            '十二神将板・龍樹滅業棒',              '本', 7),
  (6, 'symbols',      '各種符',                            '各種符',                              '枚', 8),
  (6, 'water',        '御神水・命泉・泉・龍華水・禄存五聖杯', '御神水・命泉・泉・龍華水・禄存五聖杯', '箱', 9);

-- ceremony_id=7 長生南十字星護摩供
INSERT INTO tally_items (ceremony_id, item_key, name, summary_name, unit, sort_order) VALUES
  (7, 'seekers',     '得道者数',                       '得道者数',                       '人', 1),
  (7, 'tenchi',      '天地免劫護摩木',                 'この護摩供に向けての天地免劫護摩木', '本', 2),
  (7, 'goma',        '各種護摩木',                     'この護摩供に向けての各種護摩木',     '本', 3),
  (7, 'sanki_proxy', '三期滅劫之霊木代理奉納',         '三期滅劫之霊木代理奉納',         '本', 4),
  (7, 'ryuge_proxy', '三會龍華之御柱代理奉納',         '三會龍華之御柱代理奉納',         '本', 5),
  (7, 'shisho',      '四生解消十字',                   '四生解消十字',                   '枚', 6),
  (7, 'nankyoku',    '南極寿星札',                     '南極寿星札',                     '枚', 7),
  (7, 'symbols',     '各種符',                         '各種符',                         '枚', 8),
  (7, 'water',       '御神水他・龍華水',               '御神水他・龍華水',               '箱', 9);

-- ceremony_id=8 妙善閻魔天王護摩供
INSERT INTO tally_items (ceremony_id, item_key, name, summary_name, unit, sort_order) VALUES
  (8, 'seekers',      '得道者数',                              '得道者数',                              '人', 1),
  (8, 'tenchi',       '天地免劫護摩木',                        'この護摩供に向けての天地免劫護摩木',    '本', 2),
  (8, 'goma',         '各種護摩木',                            'この護摩供に向けての各種護摩木',        '本', 3),
  (8, 'jigoku',       '地獄曼荼羅會代理奉納',                  '地獄曼荼羅會代理奉納',                  '本', 4),
  (8, 'kokujyo',      '黒縄供養紐・水子萬灯會代理奉納',        '黒縄供養紐・水子萬灯會代理奉納',        '本', 5),
  (8, 'sanki_proxy',  '三期滅劫之霊木代理奉納',                '三期滅劫之霊木代理奉納',                '本', 6),
  (8, 'ryuge_proxy',  '三會龍華之御柱代理奉納',                '三會龍華之御柱代理奉納',                '本', 7),
  (8, 'kagami',       '鏡符・五雷懺悔鏡代理奉納',              '鏡符・五雷懺悔鏡代理奉納',              '枚', 8),
  (8, 'myozen_fuda',  '妙善閻魔天王札',                        '妙善閻魔天王札',                        '体', 9),
  (8, 'symbols',      '各種符',                                '各種符',                                '枚', 10),
  (8, 'water',        '御神水・命泉・泉・龍華水等',            '御神水・命泉・泉・龍華水等',            '箱', 11);

-- ceremony_id=9 鎮魂四海龍王護摩供
INSERT INTO tally_items (ceremony_id, item_key, name, summary_name, unit, sort_order) VALUES
  (9, 'seekers',      '得道者数',                       '得道者数',                                       '人', 1),
  (9, 'tenchi',       '天地免劫護摩木',                 'この護摩供に向けての天地免劫護摩木',             '本', 2),
  (9, 'goma',         '各種護摩木',                     'この護摩供に向けての各種護摩木(媽祖救航灯代理奉納を除く)', '本', 3),
  (9, 'maso',         '媽祖救航灯代理奉納',             '媽祖救航灯代理奉納',                             '本', 4),
  (9, 'zenigata',     '銭型代理奉納',                   '銭型代理奉納',                                   '組', 5),
  (9, 'ryuge_proxy',  '三會龍華之御柱代理奉納',         '三會龍華之御柱代理奉納',                         '本', 6),
  (9, 'shikai_fuda',  '四海龍王札',                     '四海龍王札',                                     '枚', 7),
  (9, 'symbols',      '各種符',                         '各種符',                                         '枚', 8),
  (9, 'water',        '御神水・命泉・泉・龍華水',       '御神水・命泉・泉・龍華水',                       '箱', 9);

-- 報告設定 (1行固定)
INSERT INTO report_settings (
  id, enabled, send_time, sender_name, branch_name, branch_code, notify_email
) VALUES (
  1, 0, '22:00', '聖明王院事務局', '聖明王院', '99300', 'jimmyouou@gmail.com'
);

-- 現在の護摩供
INSERT INTO app_settings (key, value) VALUES ('active_ceremony_id', '1');
