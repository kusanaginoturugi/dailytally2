-- 地蔵尊王護摩供: まゆ玉を左、地蔵古佛札を右にする
UPDATE tally_items
   SET sort_order = CASE item_key
     WHEN 'mayudama' THEN 7
     WHEN 'jizo_fuda' THEN 8
     ELSE sort_order
   END
 WHERE ceremony_id = 3
   AND item_key IN ('mayudama', 'jizo_fuda');
