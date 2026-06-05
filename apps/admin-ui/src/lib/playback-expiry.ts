const MIN_MINUTES = 5;
const MAX_DAYS = 90;

export function defaultExpiryDateTimeLocal(from = new Date()): string {
  const d = new Date(from.getTime() + 60 * 60 * 1000);
  return toDateTimeLocalValue(d);
}

export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function expiryIsoFromDateTimeLocal(value: string): string | null {
  const parsed = parseDateTimeLocal(value);
  return parsed ? parsed.toISOString() : null;
}

export function validateExpiryDateTimeLocal(value: string): string | null {
  const parsed = parseDateTimeLocal(value);
  if (!parsed) return 'Choose a valid date and time.';
  const minMs = Date.now() + MIN_MINUTES * 60 * 1000;
  const maxMs = Date.now() + MAX_DAYS * 24 * 60 * 60 * 1000;
  if (parsed.getTime() < minMs) {
    return `Expiry must be at least ${MIN_MINUTES} minutes from now.`;
  }
  if (parsed.getTime() > maxMs) {
    return `Expiry cannot be more than ${MAX_DAYS} days ahead.`;
  }
  return null;
}

/** e.g. "Sunday at 10:00 PM" */
export function formatFriendlyExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${weekday} at ${time}`;
}

export function expiryDateTimeLocalAfterHours(hours: number, from = new Date()): string {
  return toDateTimeLocalValue(new Date(from.getTime() + hours * 60 * 60 * 1000));
}

export function dateTimeLocalFromIso(iso: string | undefined): string {
  if (!iso) return defaultExpiryDateTimeLocal();
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return defaultExpiryDateTimeLocal();
  return toDateTimeLocalValue(date);
}
