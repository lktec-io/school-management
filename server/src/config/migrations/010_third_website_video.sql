-- =====================================================================
-- Third website video: the scouts display from Trifonia Academy's YouTube
-- channel, stored like the Instagram reels ("yt:" marks a YouTube id).
-- Only fills the seeded list; a list the Headmaster has edited is kept.
-- =====================================================================

UPDATE system_settings
   SET setting_value = 'DdgH5x0gtdl\nDd_c3hOgiCW\nyt:uP2_RXm-cn8'
 WHERE setting_key = 'instagram_reels'
   AND setting_value = 'DdgH5x0gtdl\nDd_c3hOgiCW';
