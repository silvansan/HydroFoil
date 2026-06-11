import { config } from '../config';

const DEV_AUTH_SECRET = 'hydrofoil-dev-auth-secret';
const DEV_PLAYBACK_SECRET = 'hydrofoil-dev-playback-secret';
const DEV_ADMIN_PASSWORD = 'change-me-now';
const MIN_SECRET_LENGTH = 32;

function checkTokenSecret(envName: string, value: string, devDefault: string, errors: string[]) {
  if (!value) {
    errors.push(`${envName} is required in production`);
    return;
  }
  if (value.length < MIN_SECRET_LENGTH) {
    errors.push(`${envName} must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  if (value === devDefault) {
    errors.push(`${envName} must not use the development default`);
  }
}

export function validateProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const errors: string[] = [];

  checkTokenSecret('AUTH_TOKEN_SECRET', config.authTokenSecret, DEV_AUTH_SECRET, errors);
  checkTokenSecret('PLAYBACK_TOKEN_SECRET', config.playbackTokenSecret, DEV_PLAYBACK_SECRET, errors);

  if (!config.srsWebhookSecret) {
    errors.push('SRS_WEBHOOK_SECRET is required in production');
  }

  if (!config.storageSecretKey) {
    errors.push('STORAGE_SECRET_KEY is required in production');
  }

  if (config.defaultAdminPassword === DEV_ADMIN_PASSWORD) {
    errors.push('DEFAULT_ADMIN_PASSWORD must be changed from the development default (change-me-now)');
  }

  if (errors.length > 0) {
    const message = `Production configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`;
    throw new Error(message);
  }
}
