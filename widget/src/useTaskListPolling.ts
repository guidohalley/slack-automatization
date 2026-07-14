import { useEffect, useRef, useState } from 'react';
import { listTasks } from './api';
import type { TaskDto } from './types';

export function useTaskListPolling(apiBaseUrl: string, clientId: string, intervalMs: number) {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refetchNowRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await listTasks(apiBaseUrl, clientId);
        if (cancelled) return;
        setTasks(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'No pudimos obtener tus solicitudes');
      } finally {
        if (!cancelled) {
          setLoaded(true);
          timerRef.current = setTimeout(poll, intervalMs);
        }
      }
    }

    refetchNowRef.current = () => {
      clearTimeout(timerRef.current);
      poll();
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [apiBaseUrl, clientId, intervalMs]);

  return { tasks, error, loaded, refetch: () => refetchNowRef.current() };
}
