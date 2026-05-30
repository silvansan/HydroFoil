import type { ZodError } from 'zod';

/** Human-readable validation message for API responses (never raw Zod JSON). */
export function formatZodError(error: ZodError): string {
  const first = error.issues[0];
  if (!first) return 'Validation failed';
  const field = first.path.length > 0 ? String(first.path[first.path.length - 1]) : null;
  const label =
    field === 'appName'
      ? 'Application slug'
      : field === 'streamKey'
        ? 'Stream key'
        : field
          ? field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
          : null;
  if (label) return `${label}: ${first.message}`;
  return first.message;
}
