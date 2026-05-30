import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import pino from 'pino';

const execFileAsync = promisify(execFile);
const logger = pino({ name: 'transcode-hls' });

export async function transcodeFlvToHls(inputFlv: string): Promise<{ dir: string; manifest: string }> {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-hls-'));
  const manifest = path.join(outDir, 'index.m3u8');
  const segmentPattern = path.join(outDir, 'seg_%03d.ts');

  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputFlv,
      '-c',
      'copy',
      '-f',
      'hls',
      '-hls_time',
      '6',
      '-hls_list_size',
      '0',
      '-hls_flags',
      'independent_segments',
      '-hls_segment_filename',
      segmentPattern,
      manifest,
    ],
    { timeout: 600_000 }
  );

  return { dir: outDir, manifest };
}

export async function cleanupTranscodeDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    logger.warn({ err, dir }, 'Failed to cleanup transcode temp dir');
  }
}

export function hlsObjectPrefixFromFlvKey(objectKey: string): string {
  return objectKey.replace(/\.flv$/i, '-hls');
}
