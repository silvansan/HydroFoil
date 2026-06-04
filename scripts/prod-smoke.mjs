#!/usr/bin/env node
/**
 * Smoke-test a running prod stack (after `npm run docker:prod`).
 * Exits 0 when API + UI + DB health checks pass.
 */
import { setTimeout as sleep } from 'node:timers/promises';

const API_BASE = process.env.SMOKE_API_URL ?? 'http://localhost:3001';
const UI_BASE =
  process.env.SMOKE_UI_URL ?? process.env.PUBLIC_APP_URL ?? 'http://localhost:3080';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 120_000);
const INTERVAL_MS = 3_000;

async function waitFor(name, url, validate) {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const body = await response.text();
      if (response.ok && validate(response, body)) {
        console.log(`OK  ${name} — ${url}`);
        return;
      }
      lastError = `${response.status} ${body.slice(0, 120)}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    process.stdout.write(`… waiting for ${name} (${lastError})\n`);
    await sleep(INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for ${name} at ${url}: ${lastError}`);
}

await waitFor('control-api /health', `${API_BASE}/health`, (_res, body) => {
  try {
    return JSON.parse(body).status === 'ok';
  } catch {
    return false;
  }
});

await waitFor('admin-ui (nginx)', `${UI_BASE}/`, (res, body) => {
  return res.headers.get('content-type')?.includes('text/html') && body.includes('<!DOCTYPE html');
});

await waitFor('admin-ui → API proxy', `${UI_BASE}/api/health`, (_res, body) => {
  try {
    const json = JSON.parse(body);
    return json.status === 'ok' && json.database === 'ok';
  } catch {
    return body.includes('ok');
  }
});

console.log('Prod smoke checks passed.');
