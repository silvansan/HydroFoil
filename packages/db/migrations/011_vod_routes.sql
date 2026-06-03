CREATE TABLE IF NOT EXISTS vod_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  request_domain VARCHAR(255),
  public_path VARCHAR(1024) NOT NULL,
  delivery_type VARCHAR(50) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  storage_location_id UUID REFERENCES storage_locations(id) ON DELETE SET NULL,
  source_path VARCHAR(2048) NOT NULL,
  domain_block_id UUID REFERENCES domain_blocks(id) ON DELETE SET NULL,
  allow_direct_access BOOLEAN DEFAULT false,
  generate_iframe_playlist BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, public_path)
);

CREATE INDEX IF NOT EXISTS vod_routes_org_public_path_idx
  ON vod_routes (organization_id, public_path);

CREATE INDEX IF NOT EXISTS vod_routes_domain_block_idx
  ON vod_routes (organization_id, domain_block_id);
