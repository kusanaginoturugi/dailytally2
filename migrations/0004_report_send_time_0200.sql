UPDATE report_settings
   SET send_time = '02:00',
       updated_at = CURRENT_TIMESTAMP
 WHERE id = 1;
