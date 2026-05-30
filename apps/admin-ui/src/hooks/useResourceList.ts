import React from 'react';

export function useResourceList<T>(
  loader: () => Promise<{ items: T[] }>,
  deps: React.DependencyList = []
) {
  const [items, setItems] = React.useState<T[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await loader();
      setItems(result.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(
        message.includes('fetch')
          ? 'Cannot reach control-api. Is it running on port 3001 with Docker (Postgres/Redis) up?'
          : message
      );
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, deps);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return { items, isLoading, error, reload, setItems };
}
