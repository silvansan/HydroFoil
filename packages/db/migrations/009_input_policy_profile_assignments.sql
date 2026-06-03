-- Allow inputs to use multiple recording, stream/transcode, and audio policies.

CREATE TABLE IF NOT EXISTS input_recording_policies (
  input_id UUID NOT NULL REFERENCES inputs(id) ON DELETE CASCADE,
  recording_policy_id UUID NOT NULL REFERENCES recording_policies(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (input_id, recording_policy_id)
);

CREATE TABLE IF NOT EXISTS input_stream_profiles (
  input_id UUID NOT NULL REFERENCES inputs(id) ON DELETE CASCADE,
  stream_profile_id UUID NOT NULL REFERENCES stream_profiles(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (input_id, stream_profile_id)
);

CREATE TABLE IF NOT EXISTS input_audio_feed_profiles (
  input_id UUID NOT NULL REFERENCES inputs(id) ON DELETE CASCADE,
  audio_feed_profile_id UUID NOT NULL REFERENCES audio_feed_profiles(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (input_id, audio_feed_profile_id)
);

INSERT INTO input_recording_policies (input_id, recording_policy_id, sort_order)
SELECT id, recording_policy_id, 0
FROM inputs
WHERE recording_policy_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO input_stream_profiles (input_id, stream_profile_id, sort_order)
SELECT id, stream_profile_id, 0
FROM inputs
WHERE stream_profile_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO input_audio_feed_profiles (input_id, audio_feed_profile_id, sort_order)
SELECT id, audio_feed_profile_id, 0
FROM inputs
WHERE audio_feed_profile_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS input_recording_policies_policy_idx
  ON input_recording_policies(recording_policy_id);
CREATE INDEX IF NOT EXISTS input_stream_profiles_profile_idx
  ON input_stream_profiles(stream_profile_id);
CREATE INDEX IF NOT EXISTS input_audio_feed_profiles_profile_idx
  ON input_audio_feed_profiles(audio_feed_profile_id);
