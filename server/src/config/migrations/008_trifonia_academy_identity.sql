-- =====================================================================
-- School identity: Trifonia Academy, Zanzibar (Registration No. S1819).
-- Written to system_settings so report cards, receipts, SMS signatures
-- ({school}), the public website and the login page all show it.
-- The Headmaster can still edit these later under School Settings.
-- =====================================================================

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('school_name', 'Trifonia Academy'),
  ('registration_no', 'S1819'),
  ('motto', 'Knowledge is Power'),
  ('phone', '+255 776 119 799 / +255 65 649 9288'),
  ('instagram_url', 'https://www.instagram.com/trifonia_academy_zanzibar/')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
