-- 第15回泉珠収天護摩供の開壇数は「壇」で数える。
UPDATE tally_items
   SET unit = '壇'
 WHERE ceremony_id = 10
   AND item_key = 'altar';
