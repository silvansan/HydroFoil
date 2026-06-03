-- Phase 2 moderator scopes: privacy policies (domain blocks) and storage locations.

CREATE TABLE IF NOT EXISTS user_domain_block_assignments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_block_id UUID NOT NULL REFERENCES domain_blocks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, domain_block_id)
);

CREATE TABLE IF NOT EXISTS user_storage_location_assignments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_location_id UUID NOT NULL REFERENCES storage_locations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, storage_location_id)
);
