import type { TaskStatus } from './types';

// Client-facing translations. Cursor's raw text, diffs, and file names must
// never surface here — only these fixed, non-technical phrases.
export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Recibimos tu solicitud',
  agent_running: 'Estamos trabajando en tu solicitud',
  pr_opened: 'Listo, en revisión',
  done: 'Completado',
  failed: 'Hubo un problema',
};

export const STATUS_DESCRIPTIONS: Record<TaskStatus, string> = {
  pending: 'Tu reporte fue recibido y está en cola para ser atendido.',
  agent_running: 'Nuestro equipo está resolviendo tu solicitud.',
  pr_opened: 'La solución está lista y en revisión antes de publicarse.',
  done: 'Tu solicitud fue resuelta.',
  failed: 'No pudimos completarla automáticamente. Nuestro equipo ya fue notificado.',
};

const TERMINAL_STATUSES: readonly TaskStatus[] = ['done', 'failed'];

export function isTerminalStatus(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
