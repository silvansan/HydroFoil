#!/usr/bin/env node
/**
 * Smoke-test prod stack in CI without host port bindings (see docker-compose.ci.yml).
 */
import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const COMPOSE =
  process.env.COMPOSE_CMD ??
  'docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.ci.yml';

function execIn(service, shellCommand) {
  execSync(`${COMPOSE} exec -T ${service} sh -c ${JSON.stringify(shellCommand)}`, {
    stdio: 'inherit',
  });
}

const waitDeadline = Date.now() + 90_000;
while (Date.now() < waitDeadline) {
  const running = execSync(`${COMPOSE} ps --status running --services`, { encoding: 'utf8' });
  if (running.includes('admin-ui') && running.includes('control-api')) {
    break;
  }
  await sleep(3000);
}

console.log('CI smoke: control-api /health');
execIn(
  'control-api',
  `node -e "fetch('http://127.0.0.1:3001/health').then(async r=>{const j=await r.json();if(j.status!=='ok'){console.error(j);process.exit(1)}console.log('OK',j.status)}).catch(e=>{console.error(e);process.exit(1)})"`
);

console.log('CI smoke: admin-ui nginx');
execIn('admin-ui', "wget -qO- http://127.0.0.1:80/ | head -c 500 | grep -qi '<!DOCTYPE html'");

console.log('CI smoke: admin-ui → API proxy');
execIn(
  'admin-ui',
  "wget -qO- http://127.0.0.1:80/api/health | grep -q '\"status\":\"ok\"'"
);

console.log('CI smoke checks passed.');
