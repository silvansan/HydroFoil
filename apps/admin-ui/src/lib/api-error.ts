/** Turn API / Zod error payloads into a short user-facing string. */
export function formatApiError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    return trimmed;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0] as { message?: string; path?: string[] };
      if (first.message) {
        const field = first.path?.[first.path.length - 1];
        if (field === 'appName') return `Application slug: ${first.message}`;
        if (field === 'streamKey') return `Stream key: ${first.message}`;
        if (field) return `${String(field)}: ${first.message}`;
        return first.message;
      }
    }
  } catch {
    /* use raw */
  }
  return trimmed.length > 200 ? 'Something went wrong. Check your input and try again.' : trimmed;
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return formatApiError(err.message);
  return fallback;
}
