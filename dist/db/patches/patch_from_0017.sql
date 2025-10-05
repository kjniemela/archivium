UPDATE schema_version SET version = 18, comment = 'Allow invites and add gallery index', time = NOW();

ALTER TABLE itemimage
ADD COLUMN idx INT NOT NULL;

ALTER TABLE universeaccessrequest
ADD COLUMN is_invite BOOLEAN DEFAULT FALSE;
