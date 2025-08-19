UPDATE schema_version SET version = 14, comment = 'Allow user custom theme, add premium beta plan', time = NOW();

ALTER TABLE user
ADD COLUMN custom_theme JSON DEFAULT NULL;

SET SQL_SAFE_UPDATES = 0; -- Not optimal, but anything else I can think of would be ugly
UPDATE userplan SET plan = 4 WHERE plan = 3;
SET SQL_SAFE_UPDATES = 1;
