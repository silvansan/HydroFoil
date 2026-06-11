-- Track playback token generation per input so signed links can be rotated.

ALTER TABLE inputs
  ADD COLUMN IF NOT EXISTS playback_token_generation INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN inputs.playback_token_generation IS
  'Incremented when operators issue a new signed playback link; tokens carry this generation and older generations are rejected.';
