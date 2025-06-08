UPDATE schema_version SET version = 10, comment = 'Add stories', time = NOW();

CREATE TABLE story (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(128),
  description VARCHAR(2048),
  author_id INT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (author_id) REFERENCES user (id)
);

CREATE TABLE storychapter (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(128),
  description VARCHAR(2048),
  body TEXT NOT NULL,
  story_id INT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (story_id) REFERENCES story (id)
);
