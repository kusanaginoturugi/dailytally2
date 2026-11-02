-- 泉珠収天護摩供は3月5日・15日のみ集計し、3月21日を最終日とする。
DELETE FROM ceremony_tally_dates
 WHERE ceremony_id = 10
   AND tally_date IN (
     '2027-03-14',
     '2027-03-16',
     '2027-03-17',
     '2027-03-18',
     '2027-03-19',
     '2027-03-20'
   );
