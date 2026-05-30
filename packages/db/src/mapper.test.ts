import { describe, expect, it } from 'vitest';

import { mapStorageLocation, mapStorageLocationWithSecrets } from './mapper';

const row = {
  id: 'storage-1',
  organization_id: 'org-1',
  name: 'Remote S3',
  type: 's3',
  bucket_name: 'remote-bucket',
  prefix_path: 'recordings',
  is_default: false,
  endpoint: 's3.example.com',
  region: 'eu-central-1',
  use_ssl: true,
  public_endpoint: 'cdn.example.com',
  path_style: false,
  access_key: 'access-key',
  secret_key: 'secret-key',
  created_at: '2026-05-30T08:00:00.000Z',
  updated_at: '2026-05-30T08:00:00.000Z',
};

describe('storage location mapper', () => {
  it('hides credentials from public storage location objects', () => {
    const mapped = mapStorageLocation(row);

    expect(mapped).toMatchObject({
      id: 'storage-1',
      type: 's3',
      bucketName: 'remote-bucket',
      endpoint: 's3.example.com',
      region: 'eu-central-1',
      useSsl: true,
      publicEndpoint: 'cdn.example.com',
      pathStyle: false,
      hasCredentials: true,
    });
    expect(mapped).not.toHaveProperty('accessKey');
    expect(mapped).not.toHaveProperty('secretKey');
  });

  it('exposes credentials only through the internal mapper', () => {
    expect(mapStorageLocationWithSecrets(row)).toMatchObject({
      accessKey: 'access-key',
      secretKey: 'secret-key',
      hasCredentials: true,
    });
  });
});
