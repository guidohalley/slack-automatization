import type { TaskDto } from './types';

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed with status ${res.status}`;
  } catch {
    return `Request failed with status ${res.status}`;
  }
}

export interface CreateTaskParams {
  clientId: string;
  title: string;
  description: string;
  screenshot?: File | null;
}

export async function createTask(apiBaseUrl: string, params: CreateTaskParams): Promise<TaskDto> {
  const form = new FormData();
  form.set('clientId', params.clientId);
  form.set('title', params.title);
  form.set('description', params.description);
  if (params.screenshot) {
    form.set('screenshot', params.screenshot);
  }

  const res = await fetch(`${apiBaseUrl}/api/tasks`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function fetchTask(apiBaseUrl: string, taskId: string): Promise<TaskDto> {
  const res = await fetch(`${apiBaseUrl}/api/tasks/${taskId}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}

export async function askStatus(apiBaseUrl: string, taskId: string): Promise<TaskDto> {
  const res = await fetch(`${apiBaseUrl}/api/tasks/${taskId}/ask-status`, { method: 'POST' });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return res.json();
}
