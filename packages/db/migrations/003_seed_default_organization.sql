-- Default tenant for local development (slug: default)

INSERT INTO organizations (id, name, slug, description)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Default Organization',
  'default',
  'Local development tenant'
)
ON CONFLICT (slug) DO NOTHING;
