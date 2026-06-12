-- 地蔵尊王護摩供: 地蔵古佛札を左、まゆ玉を右にする
UPDATE tally_items
   SET sort_order = CASE item_key
     WHEN 'jizo_fuda' THEN 7
     WHEN 'mayudama' THEN 8
     ELSE sort_order
   END
 WHERE ceremony_id = 3
   AND item_key IN ('jizo_fuda', 'mayudama');
