/** Parse catalog storage_location (bucket/prefix) + object_key into MinIO coordinates. */
export function resolveMinioObject(
  storageLocation: string,
  objectKey: string
): { bucket: string; objectKey: string } {
  const parts = storageLocation.split('/').filter(Boolean);
  const bucket = parts[0] ?? 'hydrofoil';
  const prefix = parts.slice(1).join('/');
  const fullKey = prefix ? `${prefix}/${objectKey.replace(/^\/+/, '')}` : objectKey.replace(/^\/+/, '');
  return { bucket, objectKey: fullKey };
}
