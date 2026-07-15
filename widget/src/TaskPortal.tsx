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
  /** Logged-in user's name/email, if the embedding system has one. Shown as "Reportado por". */
  reporterName?: string | null;
  theme?: TaskPortalTheme;
  /** Polling interval for the task list. */
  pollIntervalMs?: number;
}

const DEFAULT_THEME: Required<TaskPortalTheme> = {
  backgroundColor: '#ffffff',
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

function MisionaryMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M14.4434 4.153C14.4434 3.27262 13.7277 2.55688 12.8473 2.55688H5.4331C5.00637 2.55688 4.61758 2.72547 4.33078 2.99857L3.00856 4.31985C2.72932 4.60806 2.55664 5.00079 2.55664 5.43288V12.8471C2.55664 13.7275 3.27284 14.4437 4.15322 14.4437H11.5674C11.9875 14.4437 12.3697 14.2809 12.6548 14.0152L13.9907 12.6821C14.2704 12.3934 14.4434 12.0002 14.4434 11.5674V4.15315V4.153ZM14.2227 11.5672C14.2227 12.2173 13.77 12.7635 13.1628 12.9066C13.0908 12.9237 13.0162 12.9348 12.9403 12.9401C12.9095 12.9423 12.8785 12.9433 12.8472 12.9433H5.43295C4.6744 12.9433 4.05705 12.3259 4.05705 11.5674V4.15315C4.05705 4.12183 4.05799 4.09098 4.0602 4.05997C4.06555 3.9841 4.07657 3.90949 4.09372 3.83755C4.23665 3.23027 4.78301 2.77757 5.4331 2.77757H12.8473C13.6059 2.77757 14.2229 3.39445 14.2229 4.15315V11.5674L14.2227 11.5672Z"
        fill="#262626"
      />
      <path
        d="M14.2228 4.15301V11.5672C14.2228 12.2173 13.7701 12.7635 13.1628 12.9066C13.0909 12.9238 13.0163 12.9348 12.9404 12.9401C12.9096 12.9423 12.8786 12.9433 12.8472 12.9433H5.43303C4.67448 12.9433 4.05713 12.3259 4.05713 11.5674V4.15317C4.05713 4.12185 4.05807 4.091 4.06028 4.05999C4.06563 3.98412 4.07665 3.9095 4.09381 3.83757C4.23673 3.23029 4.78309 2.77759 5.43318 2.77759H12.8474C13.6059 2.77759 14.223 3.39447 14.223 4.15317L14.2228 4.15301Z"
        fill="#E9FC87"
      />
      <path
        d="M5.34961 11.2905V4.43506H7.05087L9.12062 8.90763L11.1904 4.43506H12.8916V11.2905H11.2308V7.5851L9.67595 10.8866H8.56544L7.01057 7.5851V11.2905H5.34977H5.34961Z"
        fill="#262626"
      />
    </svg>
  );
}

export function TaskPortal({
  apiBaseUrl,
  clientId,
  reporterName,
  theme,
  pollIntervalMs = 10000,
}: TaskPortalProps) {
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
        '--mtp-bg': mergedTheme.backgroundColor,
        fontFamily: mergedTheme.fontFamily,
      }) as React.CSSProperties,
    [mergedTheme.backgroundColor, mergedTheme.fontFamily],
  );

  async function handleSubmit(evt: React.FormEvent) {
    evt.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createTask(apiBaseUrl, { clientId, title, description, reporterName, screenshot });
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

      <div className="mtp-header">
        <MisionaryMark />
        <span className="mtp-header-title">Soporte del Equipo de Misionary</span>
      </div>

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
        <span className={`mtp-badge mtp-badge-${task.status}`}>
          <span className="mtp-badge-dot" />
          {STATUS_LABELS[task.status]}
        </span>
      </div>
      <p className="mtp-assignee">
        {task.reporterName && (
          <>
            Reportado por <strong>{task.reporterName}</strong> ·{' '}
          </>
        )}
        Asignada a <strong>{task.assigneeName}</strong>
      </p>
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

// Misionary brand: ink (#262626) + lime (#E9FC87/#CBE65D) used sparingly as
// an accent, not as fills - subtle/professional over decorative. Corners are
// barely rounded (2-4px), not pill-shaped, matching the "Cloudflare-ish"
// reference the design is meant to follow.
const STYLES = `
.mtp-root {
  color: #262626;
  background: var(--mtp-bg);
  border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.09);
  padding: 0;
  max-width: 900px;
  box-sizing: border-box;
  overflow: hidden;
}
.mtp-root * { box-sizing: border-box; }

.mtp-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  background: #FAFAFA;
}
.mtp-header-title { font-size: 13px; font-weight: 600; color: #404040; letter-spacing: 0.01em; }

.mtp-columns { display: flex; gap: 28px; align-items: flex-start; flex-wrap: wrap; padding: 20px; }
.mtp-form { flex: 1 1 300px; min-width: 260px; }
.mtp-list { flex: 1.2 1 300px; min-width: 260px; }

.mtp-title { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
.mtp-label { display: block; font-size: 12px; margin: 10px 0 4px; font-weight: 500; color: #404040; }
.mtp-input, .mtp-textarea {
  width: 100%; padding: 7px 10px; border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.15); font-size: 13px; font-family: inherit;
  color: inherit; background: transparent;
}
.mtp-input:focus, .mtp-textarea:focus {
  outline: none; border-color: #CBE65D; box-shadow: 0 0 0 3px rgba(203,230,93,0.35);
}
.mtp-textarea { resize: vertical; }
.mtp-file-input { width: 100%; font-size: 12px; }
.mtp-button {
  margin-top: 16px; padding: 8px 16px; border: 1px solid #262626; border-radius: 4px;
  background: #262626; color: #fff; font-size: 13px; font-weight: 600;
  cursor: pointer;
}
.mtp-button:hover:not(:disabled) { background: #404040; }
.mtp-button:disabled { opacity: 0.5; cursor: not-allowed; }
.mtp-button-secondary { background: transparent; color: #262626; border: 1px solid rgba(0,0,0,0.2); }
.mtp-button-secondary:hover:not(:disabled) { border-color: #262626; }
.mtp-button-sm { margin-top: 0; padding: 5px 10px; font-size: 12px; }
.mtp-error { color: #b91c1c; font-size: 12px; margin-top: 8px; }
.mtp-description { font-size: 13px; margin: 6px 0; color: #404040; }
.mtp-assignee { font-size: 12px; margin: 4px 0 0; color: #737373; }
.mtp-hint { font-size: 12px; opacity: 0.8; }

.mtp-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 9px; border-radius: 4px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.01em;
  background: #F5F5F5; color: #404040;
  border: 1px solid rgba(0,0,0,0.07);
  white-space: nowrap;
}
.mtp-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #A3A3A3; flex-shrink: 0; }
.mtp-badge-failed .mtp-badge-dot { background: #DC2626; }
.mtp-badge-done .mtp-badge-dot, .mtp-badge-pr_opened .mtp-badge-dot { background: #CBE65D; }

.mtp-list-title { margin: 0 0 10px; font-size: 13px; font-weight: 600; }
.mtp-list-items { max-height: 520px; overflow-y: auto; padding-right: 4px; }
.mtp-item {
  border: 1px solid rgba(0,0,0,0.09); border-radius: 4px; padding: 10px 12px; margin-bottom: 8px;
}
.mtp-item:last-child { margin-bottom: 0; }
.mtp-item-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.mtp-item-title { margin: 0; font-size: 13px; font-weight: 600; }
.mtp-item-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
.mtp-item-date { font-size: 11px; color: #A3A3A3; }
`;
