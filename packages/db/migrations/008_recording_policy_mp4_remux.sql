ALTER TABLE recording_policies
ADD COLUMN IF NOT EXISTS remux_to_mp4 BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS keep_source_flv_hours INTEGER;

UPDATE recording_policies
SET keep_source_flv_hours = 24
WHERE keep_source_flv_hours IS NULL
  AND remux_to_mp4 = true;
