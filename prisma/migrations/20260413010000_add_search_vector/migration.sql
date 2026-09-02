-- Add tsvector column
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Populate from existing data
UPDATE "Agent" SET "searchVector" =
  setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("shortDesc", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("description", '')), 'C') ||
  setweight(to_tsvector('english', coalesce(array_to_string("tags", ' '), '')), 'B');

-- Create GIN index
CREATE INDEX IF NOT EXISTS "Agent_searchVector_idx" ON "Agent" USING GIN ("searchVector");

-- Auto-update trigger
CREATE OR REPLACE FUNCTION agent_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."shortDesc", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."tags", ' '), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_search_update ON "Agent";
CREATE TRIGGER agent_search_update
  BEFORE INSERT OR UPDATE OF "name", "shortDesc", "description", "tags"
  ON "Agent"
  FOR EACH ROW
  EXECUTE FUNCTION agent_search_vector_update();
