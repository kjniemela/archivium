UPDATE schema_version SET version = 18, comment = 'Drop newsletter table', time = NOW();

DROP TABLE newsletter;
