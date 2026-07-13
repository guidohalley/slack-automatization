import { useEffect, useRef, useState } from 'react';
import { fetchTask } from './api';
import { isTerminalStatus } from './statusLabels';
import type { TaskDto } from './types';

export function useTaskPolling(apiBaseUrl: string, taskId: string | null, intervalMs: number) {
  const [task, setTask] = useState<TaskDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setTask(null);
    setError(null);
    if (!taskId) return;

    let cancelled = false;

    async function poll() {
      let shouldContinue = true;
      try {
        const data = await fetchTask(apiBaseUrl, taskId as string);
        if (cancelled) return;
        setTask(data);
        setError(null);
        shouldContinue = !isTerminalStatus(data.status);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'No pudimos obtener el estado');
      } finally {
        if (!cancelled && shouldContinue) {
          timerRef.current = setTimeout(poll, intervalMs);
        }
      }
    }

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, taskId, intervalMs]);

  return { task, error };
}
