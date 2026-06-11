export function normalizeStoragePrefix(prefix: unknown): string {
  return String(prefix ?? '').replace(/^\/+|\/+$/g, '');
}

/** Join a location root prefix with a relative object key without double-prefixing. */
export function resolveLocationObjectKey(
  location: { prefixPath?: string | null },
  objectKey: string
): string {
  const basePrefix = normalizeStoragePrefix(location.prefixPath);
  const cleanKey = objectKey.replace(/^\/+/, '');
  if (!basePrefix || cleanKey === basePrefix || cleanKey.startsWith(`${basePrefix}/`)) {
    return cleanKey;
  }
  return `${basePrefix}/${cleanKey}`;
}
