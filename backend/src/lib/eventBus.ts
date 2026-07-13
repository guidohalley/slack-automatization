import { EventEmitter } from 'node:events';

// In-memory pub/sub so the SSE stream endpoint can push updates as soon as
// the Slack events handler writes a new status, instead of polling the DB.
// Single-process only; fine for one backend instance, would need Redis
// pub/sub (or similar) behind a load balancer.
export const taskEventBus = new EventEmitter();
taskEventBus.setMaxListeners(0);

export function taskUpdated(taskId: string) {
  taskEventBus.emit(`task:${taskId}`);
}

export function onTaskUpdated(taskId: string, listener: () => void) {
  taskEventBus.on(`task:${taskId}`, listener);
  return () => taskEventBus.off(`task:${taskId}`, listener);
}
