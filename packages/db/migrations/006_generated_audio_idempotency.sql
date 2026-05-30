ALTER TABLE generated_audio_assets
ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(1024);

UPDATE generated_audio_assets
SET dedupe_key = CONCAT(
  COALESCE(recording_asset_id::text, 'session'),
  ':',
  COALESCE(recording_asset_id::text, live_session_id::text, id::text),
  ':',
  audio_feed_profile_id::text,
  ':',
  codec,
  ':',
  object_key
)
WHERE dedupe_key IS NULL;

ALTER TABLE generated_audio_assets
ALTER COLUMN dedupe_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS generated_audio_assets_org_dedupe_idx
ON generated_audio_assets (organization_id, dedupe_key);
