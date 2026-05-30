import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { findSrsDvrFileInRoot } from './finalize-recording';

describe('findSrsDvrFileInRoot', () => {
  it('selects the newest matching DVR FLV after the recording start time', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'hydrofoil-dvr-discovery-'));
    const appDir = path.join(root, 'dvr', 'live');
    const oldFile = path.join(appDir, 'main.1000.flv');
    const newFile = path.join(appDir, 'main.2000.flv');
    const otherFile = path.join(appDir, 'other.2000.flv');
    const now = Date.now();

    try {
      await mkdir(appDir, { recursive: true });
      await writeFile(oldFile, 'old');
      await writeFile(newFile, 'new');
      await writeFile(otherFile, 'other');
      await utimes(oldFile, new Date(now - 30_000), new Date(now - 30_000));
      await utimes(newFile, new Date(now), new Date(now));
      await utimes(otherFile, new Date(now + 10_000), new Date(now + 10_000));

      await expect(findSrsDvrFileInRoot(root, 'live', 'main', now - 5_000)).resolves.toBe(
        newFile
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
