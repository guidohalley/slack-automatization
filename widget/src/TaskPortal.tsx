import React, { useMemo, useState } from 'react';
import { createTask, askStatus } from './api';
import { useTaskListPolling } from './useTaskListPolling';
import { STATUS_LABELS, STATUS_DESCRIPTIONS, isTerminalStatus } from './statusLabels';
import type { TaskDto, TaskPortalTheme } from './types';

export interface TaskPortalProps {
  /** Base URL of the backend, e.g. "https://api.misionary.com" */
  apiBaseUrl: string;
  /** Identifies which client/project this widget instance belongs to. */
  clientId: string;
  theme?: TaskPortalTheme;
  /** Polling interval for the task list. */
  pollIntervalMs?: number;
}

const DEFAULT_THEME: Required<TaskPortalTheme> = {
  primaryColor: '#4f46e5',
  textColor: '#1f2937',
  backgroundColor: '#ffffff',
  borderRadius: '10px',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TaskPortal({ apiBaseUrl, clientId, theme, pollIntervalMs = 10000 }: TaskPortalProps) {
  const mergedTheme = { ...DEFAULT_THEME, ...theme };

  const { tasks, error: listError, loaded, refetch } = useTaskListPolling(apiBaseUrl, clientId, pollIntervalMs);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [askingStatusId, setAskingStatusId] = useState<string | null>(null);

  const cssVars = useMemo(
    () =>
      ({
        '--mtp-primary': mergedTheme.primaryColor,
        '--mtp-text': mergedTheme.textColor,
        '--mtp-bg': mergedTheme.backgroundColor,
        '--mtp-radius': mergedTheme.borderRadius,
        fontFamily: mergedTheme.fontFamily,
      }) as React.CSSProperties,
    [mergedTheme.primaryColor, mergedTheme.textColor, mergedTheme.backgroundColor, mergedTheme.borderRadius, mergedTheme.fontFamily],
  );

  async function handleSubmit(evt: React.FormEvent) {
    evt.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createTask(apiBaseUrl, { clientId, title, description, screenshot });
      setTitle('');
      setDescription('');
      setScreenshot(null);
      refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No pudimos enviar tu solicitud');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAskStatus(taskId: string) {
    setAskingStatusId(taskId);
    try {
      await askStatus(apiBaseUrl, taskId);
      refetch();
    } catch {
      // polling will surface the current state regardless; this is best-effort
    } finally {
      setAskingStatusId(null);
    }
  }

  return (
    <div className="mtp-root" style={cssVars}>
      <style>{STYLES}</style>

      <div className="mtp-columns">
        <form className="mtp-form" onSubmit={handleSubmit}>
          <h3 className="mtp-title">Reportar una tarea o problema</h3>

          <label className="mtp-label" htmlFor="mtp-title-input">
            Título
          </label>
          <input
            id="mtp-title-input"
            className="mtp-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />

          <label className="mtp-label" htmlFor="mtp-description-input">
            Descripción
          </label>
          <textarea
            id="mtp-description-input"
            className="mtp-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={5000}
            required
          />

          <label className="mtp-label" htmlFor="mtp-screenshot-input">
            Captura de pantalla (opcional)
          </label>
          <input
            id="mtp-screenshot-input"
            className="mtp-file-input"
            type="file"
            accept="image/*"
            onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
          />

          {submitError && <p className="mtp-error">{submitError}</p>}

          <button className="mtp-button" type="submit" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>

        <div className="mtp-list">
          <h4 className="mtp-list-title">Tus solicitudes{tasks.length > 0 ? ` (${tasks.length})` : ''}</h4>

          {!loaded && <p className="mtp-description">Cargando...</p>}
          {loaded && tasks.length === 0 && (
            <p className="mtp-description">Todavía no reportaste nada.</p>
          )}
          {listError && <p className="mtp-error">{listError}</p>}

          <div className="mtp-list-items">
            {tasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                asking={askingStatusId === task.id}
                onAskStatus={() => handleAskStatus(task.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskListItem({
  task,
  asking,
  onAskStatus,
}: {
  task: TaskDto;
  asking: boolean;
  onAskStatus: () => void;
}) {
  return (
    <div className="mtp-item">
      <div className="mtp-item-header">
        <p className="mtp-item-title">{task.title}</p>
        <span className={`mtp-badge mtp-badge-${task.status}`}>{STATUS_LABELS[task.status]}</span>
      </div>
      <p className="mtp-description">{STATUS_DESCRIPTIONS[task.status]}</p>
      {task.status === 'pr_opened' && task.prUrl && (
        <p className="mtp-hint">Tu solución está en revisión antes de publicarse.</p>
      )}
      <div className="mtp-item-footer">
        <span className="mtp-item-date">{formatDate(task.createdAt)}</span>
        {!isTerminalStatus(task.status) && (
          <button
            className="mtp-button mtp-button-secondary mtp-button-sm"
            type="button"
            onClick={onAskStatus}
            disabled={asking}
          >
            {asking ? 'Consultando...' : 'Actualizar estado'}
          </button>
        )}
      </div>
    </div>
  );
}

const STYLES = `
.mtp-root {
  color: var(--mtp-text);
  background: var(--mtp-bg);
  border-radius: var(--mtp-radius);
  border: 1px solid rgba(0,0,0,0.1);
  padding: 20px;
  max-width: 900px;
  box-sizing: border-box;
}
.mtp-root * { box-sizing: border-box; }
.mtp-columns { display: flex; gap: 28px; align-items: flex-start; flex-wrap: wrap; }
.mtp-form { flex: 1 1 300px; min-width: 260px; }
.mtp-list { flex: 1.2 1 300px; min-width: 260px; }
.mtp-title { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
.mtp-label { display: block; font-size: 13px; margin: 10px 0 4px; font-weight: 500; }
.mtp-input, .mtp-textarea {
  width: 100%; padding: 8px 10px; border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.2); font-size: 14px; font-family: inherit;
  color: inherit; background: transparent;
}
.mtp-textarea { resize: vertical; }
.mtp-file-input { width: 100%; font-size: 13px; }
.mtp-button {
  margin-top: 16px; padding: 9px 16px; border: none; border-radius: 6px;
  background: var(--mtp-primary); color: #fff; font-size: 14px; font-weight: 600;
  cursor: pointer;
}
.mtp-button:disabled { opacity: 0.6; cursor: not-allowed; }
.mtp-button-secondary { background: transparent; color: var(--mtp-primary); border: 1px solid var(--mtp-primary); }
.mtp-button-sm { margin-top: 0; padding: 5px 10px; font-size: 12px; }
.mtp-error { color: #dc2626; font-size: 13px; margin-top: 8px; }
.mtp-description { font-size: 14px; margin: 8px 0; }
.mtp-hint { font-size: 13px; opacity: 0.8; }
.mtp-badge {
  display: inline-block; padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600; background: rgba(79,70,229,0.12); color: var(--mtp-primary);
  white-space: nowrap;
}
.mtp-badge-failed { background: rgba(220,38,38,0.12); color: #dc2626; }
.mtp-badge-done, .mtp-badge-pr_opened { background: rgba(22,163,74,0.12); color: #16a34a; }

.mtp-list-title { margin: 0 0 10px; font-size: 14px; font-weight: 600; }
.mtp-list-items { max-height: 520px; overflow-y: auto; padding-right: 4px; }
.mtp-item {
  border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 10px 12px; margin-bottom: 10px;
}
.mtp-item:last-child { margin-bottom: 0; }
.mtp-item-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.mtp-item-title { margin: 0; font-size: 14px; font-weight: 600; }
.mtp-item-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; }
.mtp-item-date { font-size: 12px; opacity: 0.6; }
`;
