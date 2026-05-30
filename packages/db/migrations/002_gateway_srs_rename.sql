-- Idempotent rename for databases created from early OME-oriented 001

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stream_profiles' AND column_name = 'ome_mapping'
  ) THEN
    ALTER TABLE stream_profiles RENAME COLUMN ome_mapping TO gateway_mapping;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outputs' AND column_name = 'ome_app_name'
  ) THEN
    ALTER TABLE outputs RENAME COLUMN ome_app_name TO gateway_app_name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outputs' AND column_name = 'ome_stream_name'
  ) THEN
    ALTER TABLE outputs RENAME COLUMN ome_stream_name TO gateway_stream_name;
  END IF;
END $$;
