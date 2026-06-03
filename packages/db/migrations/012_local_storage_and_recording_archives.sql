ALTER TABLE storage_locations
  ADD COLUMN IF NOT EXISTS local_path TEXT;

ALTER TABLE recording_policies
  ADD COLUMN IF NOT EXISTS archive_storage_location_id UUID REFERENCES storage_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_path_prefix TEXT;
