CREATE TABLE user (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(64) UNIQUE NOT NULL,
  password VARCHAR(64) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE session (
  id INT NOT NULL AUTO_INCREMENT,
  hash VARCHAR(64) NOT NULL,
  user_id INT,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user (id),
  PRIMARY KEY (id)
);

CREATE TABLE image (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  name VARCHAR(64) NOT NULL,
  data LONGBLOB NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES user (id)
);

CREATE TABLE contact (
  requesting_user INT NOT NULL,
  accepting_user INT NOT NULL,
  accepted BOOLEAN,
  FOREIGN KEY (requesting_user) REFERENCES user (id),
  FOREIGN KEY (accepting_user) REFERENCES user (id)
);

CREATE TABLE universe (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(64) NOT NULL,
  shortname VARCHAR(64) UNIQUE NOT NULL,
  author_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  public BOOLEAN NOT NULL,
  obj_data TEXT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES user (id),
  PRIMARY KEY (id)
);

CREATE TABLE item (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(64) NOT NULL,
  shortname VARCHAR(64) NOT NULL,
  item_type VARCHAR(16) NOT NULL,
  author_id INT NOT NULL,
  universe_id INT NOT NULL,
  UNIQUE(shortname, universe_id),
  parent_id INT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  last_updated_by INT,
  obj_data TEXT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES user (id),
  FOREIGN KEY (universe_id) REFERENCES universe (id),
  FOREIGN KEY (parent_id) REFERENCES item (id),
  FOREIGN KEY (last_updated_by) REFERENCES user (id),
  PRIMARY KEY (id)
);

CREATE TABLE snooze (
  snoozed_until TIMESTAMP NOT NULL,
  snoozed_by INT NOT NULL,
  item_id INT NOT NULL,
  FOREIGN KEY (snoozed_by) REFERENCES user (id),
  FOREIGN KEY (item_id) REFERENCES item (id)
);

CREATE TABLE lineage (
  parent_id INT NOT NULL,
  child_id INT NOT NULL,
  parent_title VARCHAR(64),
  child_title VARCHAR(64),
  FOREIGN KEY (parent_id) REFERENCES item (id),
  FOREIGN KEY (child_id) REFERENCES item (id)
);

CREATE TABLE itemevent (
  id INT NOT NULL AUTO_INCREMENT,
  item_id INT NOT NULL,
  event_title VARCHAR(64),
  abstime BIGINT,
  UNIQUE(item_id, event_title),
  PRIMARY KEY (id),
  FOREIGN KEY (item_id) REFERENCES item (id)
);
CREATE INDEX idx_abstime ON itemevent (abstime);

CREATE TABLE eventorder (
  former INT NOT NULL,
  latter INT NOT NULL,
  PRIMARY KEY (former, latter),
  FOREIGN KEY (former) REFERENCES itemevent (id),
  FOREIGN KEY (latter) REFERENCES itemevent (id)
);

CREATE TABLE timelineitem (
  timeline_id INT NOT NULL,
  event_id INT NOT NULL,
  PRIMARY KEY (timeline_id, event_id),
  FOREIGN KEY (timeline_id) REFERENCES item (id),
  FOREIGN KEY (event_id) REFERENCES itemevent (id)
);

CREATE TABLE authoruniverse (
  id INT NOT NULL AUTO_INCREMENT,
  universe_id INT NOT NULL,
  user_id INT NOT NULL,
  permission_level TINYINT NOT NULL,
  FOREIGN KEY (universe_id) REFERENCES universe (id),
  FOREIGN KEY (user_id) REFERENCES user (id),
  PRIMARY KEY (id)
);

CREATE TABLE tag (
  item_id INT NOT NULL,
  tag VARCHAR(32),
  UNIQUE(item_id, tag),
  FOREIGN KEY (item_id) REFERENCES item (id)
);