import type { ClientTask } from '@prisma/client';

// The client-facing widget must never see Slack internals (channel id,
// thread ts) or raw Cursor text. This is the only shape allowed to leave
// the backend towards the widget.
export interface TaskDto {
  id: string;
  title: string;
  description: string;
  status: ClientTask['status'];
  prUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toTaskDto(task: ClientTask): TaskDto {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    prUrl: task.prUrl,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
