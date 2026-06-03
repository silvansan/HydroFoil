-- Users and role-based access control (migration 014)

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'manager',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_org_email_unique UNIQUE (organization_id, email),
  CONSTRAINT users_role_check CHECK (role IN ('super-admin', 'admin', 'manager'))
);

CREATE INDEX users_organization_idx ON users(organization_id);
CREATE INDEX users_role_idx ON users(role);
