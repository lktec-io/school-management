-- =====================================================================
-- Guardian relationship (Baba, Mama, Mlezi …) recorded with each student,
-- used by the student form and the bulk import template.
-- Instagram reels shown on the public website, one reel code per line;
-- the Headmaster manages the list under School Settings (up to three).
-- =====================================================================

ALTER TABLE students
  ADD COLUMN parent_relationship VARCHAR(40) NULL AFTER parent_phone;

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('instagram_reels', 'DdgH5x0gtdl\nDd_c3hOgiCW')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
