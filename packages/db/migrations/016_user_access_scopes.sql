-- Per-user scopes for moderators (manager role). Admins and super-admins bypass these tables.

CREATE TABLE IF NOT EXISTS user_application_assignments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, application_id)
);

CREATE INDEX IF NOT EXISTS idx_user_application_assignments_user
  ON user_application_assignments (user_id);

CREATE TABLE IF NOT EXISTS user_recording_policy_assignments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recording_policy_id UUID NOT NULL REFERENCES recording_policies(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, recording_policy_id)
);

CREATE TABLE IF NOT EXISTS user_vod_route_assignments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vod_route_id UUID NOT NULL REFERENCES vod_routes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, vod_route_id)
);
