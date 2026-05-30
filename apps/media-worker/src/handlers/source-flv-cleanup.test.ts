import { describe, expect, it, vi } from 'vitest';

import { cleanupExpiredSourceFlvCopies } from './source-flv-cleanup';

describe('cleanupExpiredSourceFlvCopies', () => {
  it('deletes expired source FLV copies and marks the asset cleaned', async () => {
    const repos = {
      recordingAssets: {
        listExpiredSourceFlvCopies: vi.fn().mockResolvedValue([
          {
            id: 'asset-1',
            organizationId: 'org-1',
            storageLocation: 'location:org-1:storage-1',
            metadata: { sourceFlvObjectKey: 'dvr/main/source.flv' },
          },
        ]),
        markSourceFlvCleaned: vi.fn().mockResolvedValue(null),
      },
    };
    const storage = {
      deleteObject: vi.fn().mockResolvedValue({ bucket: 'recordings', objectKey: 'dvr/main/source.flv' }),
    };

    const result = await cleanupExpiredSourceFlvCopies(repos as any, storage as any);

    expect(result).toEqual({ scanned: 1, cleaned: 1, failed: 0 });
    expect(storage.deleteObject).toHaveBeenCalledWith(
      'location:org-1:storage-1',
      'dvr/main/source.flv'
    );
    expect(repos.recordingAssets.markSourceFlvCleaned).toHaveBeenCalledWith('org-1', 'asset-1');
  });

  it('leaves failed deletions eligible for a later retry', async () => {
    const repos = {
      recordingAssets: {
        listExpiredSourceFlvCopies: vi.fn().mockResolvedValue([
          {
            id: 'asset-1',
            organizationId: 'org-1',
            storageLocation: 'recordings',
            metadata: { sourceFlvObjectKey: 'dvr/main/source.flv' },
          },
        ]),
        markSourceFlvCleaned: vi.fn(),
      },
    };
    const storage = {
      deleteObject: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    };

    const result = await cleanupExpiredSourceFlvCopies(repos as any, storage as any);

    expect(result).toEqual({ scanned: 1, cleaned: 0, failed: 1 });
    expect(repos.recordingAssets.markSourceFlvCleaned).not.toHaveBeenCalled();
  });
});
