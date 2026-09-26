UPDATE schema_version SET version = 27, comment = 'Add access control vaults', time = NOW();

CREATE TABLE vault (
  id INT NOT NULL AUTO_INCREMENT,
  universe_id INT NOT NULL,
  title VARCHAR(64) NOT NULL,
  shortname VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(shortname, universe_id),
  FOREIGN KEY (universe_id) REFERENCES universe (id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

CREATE TABLE vaultauthor (
  id INT NOT NULL AUTO_INCREMENT,
  vault_id INT NOT NULL,
  user_id INT NOT NULL,
  permission_level TINYINT NOT NULL,
  FOREIGN KEY (vault_id) REFERENCES vault (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

ALTER TABLE item ADD COLUMN vault_id INT NULL;
ALTER TABLE item ADD FOREIGN KEY (vault_id) REFERENCES vault (id);
