-- Default storage + recording policy for local dev tenant

INSERT INTO storage_locations (organization_id, name, type, bucket_name, prefix_path, is_default)
SELECT
  '00000000-0000-4000-8000-000000000001',
  'Default MinIO',
  'minio',
  'hydrofoil',
  'recordings',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM storage_locations
  WHERE organization_id = '00000000-0000-4000-8000-000000000001'
);

INSERT INTO recording_policies (
  organization_id,
  name,
  enabled,
  storage_location_id,
  path_prefix,
  filename_template
)
SELECT
  '00000000-0000-4000-8000-000000000001',
  'Default DVR',
  true,
  sl.id,
  'dvr',
  '{app}/{streamKey}/{timestamp}.flv'
FROM storage_locations sl
WHERE sl.organization_id = '00000000-0000-4000-8000-000000000001'
  AND sl.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM recording_policies
    WHERE organization_id = '00000000-0000-4000-8000-000000000001'
      AND name = 'Default DVR'
  );
