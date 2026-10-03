-- Fewer D1 rows read (spec "データ仕様 > キャッシュ").

-- Bumped on every change to what a member's screens show, so the API can answer a browser's
-- revalidation with 304 from this one row instead of running the screen's queries.
ALTER TABLE families ADD COLUMN data_version INTEGER NOT NULL DEFAULT 0;

-- Every write a member makes records a history row in the same batch, so one trigger covers
-- them all (children, topics, prints, members, bulk deletion).
CREATE TRIGGER histories_bump_data_version AFTER INSERT ON histories
BEGIN
  UPDATE families SET data_version = data_version + 1 WHERE id = NEW.family_id;
END;

-- Read and mitene states change without a history row (opening a print, sending a mitene).
CREATE TRIGGER print_member_states_insert_bump_data_version AFTER INSERT ON print_member_states
BEGIN
  UPDATE families SET data_version = data_version + 1
  WHERE id = (SELECT family_id FROM prints WHERE id = NEW.print_id);
END;

-- Only real changes: reopening a print already read upserts the same values.
CREATE TRIGGER print_member_states_update_bump_data_version AFTER UPDATE ON print_member_states
WHEN OLD.is_read IS NOT NEW.is_read
  OR OLD.mitene_status IS NOT NEW.mitene_status
  OR OLD.mitene_from IS NOT NEW.mitene_from
BEGIN
  UPDATE families SET data_version = data_version + 1
  WHERE id = (SELECT family_id FROM prints WHERE id = NEW.print_id);
END;

-- `WHERE child_id = ?` (deleting a child, and its ON DELETE CASCADE) scanned every family's prints.
CREATE INDEX prints_by_child ON prints (child_id);

-- `family_id = ? AND created_at >= ? / <= ?` (this week's counts, stats, bulk deletion) can't use
-- the created_at of `prints_by_created`, which has child_id in between.
CREATE INDEX prints_by_family_created ON prints (family_id, created_at);
