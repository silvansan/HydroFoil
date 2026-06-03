-- DVR Watchlist Entries
-- Track which applications/streams should be automatically recorded and retention policies

CREATE TABLE dvr_watchlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  application_name VARCHAR(255),
  stream_pattern VARCHAR(255), -- e.g. '*' for all, or 'stream-key' for specific
  retention_hours INTEGER NOT NULL DEFAULT 24,
  storage_location_id UUID NOT NULL REFERENCES storage_locations(id),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT dvr_watchlist_org_app_pattern_unique UNIQUE (organization_id, application_name, stream_pattern)
);

CREATE INDEX dvr_watchlist_org_idx ON dvr_watchlist_entries(organization_id);
CREATE INDEX dvr_watchlist_app_idx ON dvr_watchlist_entries(application_id);
CREATE INDEX dvr_watchlist_enabled_idx ON dvr_watchlist_entries(organization_id, enabled);
