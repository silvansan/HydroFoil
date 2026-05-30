ALTER TABLE storage_locations
ADD COLUMN IF NOT EXISTS endpoint VARCHAR(512),
ADD COLUMN IF NOT EXISTS region VARCHAR(128),
ADD COLUMN IF NOT EXISTS use_ssl BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS public_endpoint VARCHAR(512),
ADD COLUMN IF NOT EXISTS path_style BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS access_key VARCHAR(512),
ADD COLUMN IF NOT EXISTS secret_key TEXT;

UPDATE storage_locations
SET
  use_ssl = COALESCE(use_ssl, false),
  path_style = COALESCE(path_style, true)
WHERE type = 'minio';
