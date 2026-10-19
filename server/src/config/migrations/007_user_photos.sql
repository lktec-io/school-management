-- =====================================================================
-- Profile pictures for every account (Headmaster, Bursar, teachers, parents),
-- self-hosted under STORAGE_DIR/users.
-- =====================================================================

ALTER TABLE users
  ADD COLUMN photo_path VARCHAR(255) NULL AFTER phone;
