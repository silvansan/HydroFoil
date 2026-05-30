import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function mp4ObjectKeyFromFlvKey(objectKey: string): string {
  return objectKey.replace(/\.flv$/i, '') + '.mp4';
}

export async function remuxFlvToMp4(inputFlv: string): Promise<{ file: string; cleanup: () => Promise<void> }> {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-mp4-'));
  const output = path.join(outDir, 'recording.mp4');

  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputFlv,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      output,
    ],
    { timeout: 600_000 }
  );

  return {
    file: output,
    cleanup: () => fs.rm(outDir, { recursive: true, force: true }),
  };
}
