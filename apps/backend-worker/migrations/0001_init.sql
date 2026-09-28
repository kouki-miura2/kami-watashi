-- Schema for docs/spec.md "データ仕様". Timestamps are Unix epoch milliseconds.
-- Every FK cascades, so deleting a family (owner withdrawal, auto-deletion) or a child removes
-- everything under it in one statement. R2 objects are deleted separately by the application.

CREATE TABLE families (
  id TEXT PRIMARY KEY,
  last_accessed_at INTEGER NOT NULL,
  last_print_seq INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX families_last_accessed_at ON families (last_accessed_at);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  google_sub TEXT UNIQUE,
  key_hash TEXT UNIQUE,
  terms_version TEXT,
  terms_agreed_at INTEGER,
  UNIQUE (family_id, name),
  -- An owner has google_sub, an invited member has key_hash; never both, never neither.
  CHECK ((google_sub IS NULL) <> (key_hash IS NULL))
);

CREATE TABLE children (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  last_print_seq INTEGER NOT NULL DEFAULT 0,
  UNIQUE (family_id, name)
);

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (family_id, name)
);

CREATE TABLE prints (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  -- NULL is the family-common slot (「家族共通」枠).
  child_id TEXT REFERENCES children (id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  title TEXT,
  received_on TEXT,
  due_on TEXT,
  response_status TEXT NOT NULL DEFAULT 'none' CHECK (response_status IN ('none', 'todo', 'done')),
  created_at INTEGER NOT NULL
);

CREATE INDEX prints_by_created ON prints (family_id, child_id, created_at);
CREATE INDEX prints_by_due ON prints (family_id, child_id, due_on);

CREATE TABLE print_images (
  id TEXT PRIMARY KEY,
  print_id TEXT NOT NULL REFERENCES prints (id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  size INTEGER NOT NULL
);

CREATE INDEX print_images_print_id ON print_images (print_id);

CREATE TABLE print_topics (
  print_id TEXT NOT NULL REFERENCES prints (id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  PRIMARY KEY (print_id, topic_id)
);

CREATE INDEX print_topics_topic_id ON print_topics (topic_id);

-- No row means unread and no mitene.
CREATE TABLE print_member_states (
  print_id TEXT NOT NULL REFERENCES prints (id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  mitene_status TEXT NOT NULL DEFAULT 'none' CHECK (mitene_status IN ('none', 'requested', 'seen')),
  -- Reset to 'none' / NULL by the application before the sender is deleted; SET NULL is a backstop.
  mitene_from TEXT REFERENCES members (id) ON DELETE SET NULL,
  PRIMARY KEY (print_id, member_id)
);

CREATE INDEX print_member_states_by_member ON print_member_states (member_id, mitene_status);
CREATE INDEX print_member_states_mitene_from ON print_member_states (mitene_from);

-- Keeps the values needed for display at the time of the operation instead of FKs to the
-- target/member, so entries outlive what they describe.
CREATE TABLE histories (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('child', 'topic', 'print', 'member')),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'bulk_delete')),
  name TEXT,
  new_name TEXT,
  print_seq INTEGER,
  details TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX histories_by_family ON histories (family_id, created_at, id);
