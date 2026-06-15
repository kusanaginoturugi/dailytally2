UPDATE report_settings
   SET send_time = '23:55',
       updated_at = CURRENT_TIMESTAMP
 WHERE id = 1;
