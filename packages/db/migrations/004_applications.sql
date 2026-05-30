-- Applications = SRS ingest app (event / org / location). Inputs = stream keys within an app.

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  app_name VARCHAR(63) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT applications_org_app_name_unique UNIQUE (organization_id, app_name),
  CONSTRAINT applications_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX applications_org_idx ON applications(organization_id);

-- Default "live" application per organization for existing installs
INSERT INTO applications (organization_id, name, app_name, description)
SELECT o.id, 'Default (live)', 'live', 'Migrated default ingest application'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM applications a WHERE a.organization_id = o.id AND a.app_name = 'live'
);

ALTER TABLE inputs ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id);

UPDATE inputs i
SET application_id = a.id
FROM applications a
WHERE i.application_id IS NULL
  AND a.organization_id = i.organization_id
  AND a.app_name = 'live';

ALTER TABLE inputs ALTER COLUMN application_id SET NOT NULL;

ALTER TABLE inputs DROP CONSTRAINT IF EXISTS inputs_org_stream_key_unique;
ALTER TABLE inputs DROP CONSTRAINT IF EXISTS inputs_org_name_unique;

ALTER TABLE inputs
  ADD CONSTRAINT inputs_application_stream_key_unique
  UNIQUE (application_id, stream_key);

ALTER TABLE inputs
  ADD CONSTRAINT inputs_application_name_unique
  UNIQUE (application_id, name);

CREATE INDEX inputs_application_idx ON inputs(application_id);

ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS gateway_app VARCHAR(63);

UPDATE live_sessions ls
SET gateway_app = 'live'
WHERE ls.gateway_app IS NULL;
