/** True when SRS is actively publishing for this session record. */
export function isSessionPublishing(status: string): boolean {
  return status === 'publishing';
}
