import React, { useEffect, useMemo, useState } from 'react';
import { createTask, askStatus } from './api';
import { useTaskPolling } from './useTaskPolling';
import { STATUS_LABELS, STATUS_DESCRIPTIONS, isTerminalStatus } from './statusLabels';
import type { TaskPortalTheme } from './types';

export interface TaskPortalProps {
  /** Base URL of the backend, e.g. "https://api.misionary.com" */
  apiBaseUrl: string;
  /** Identifies which client/project this widget instance belongs to. */
  clientId: string;
  theme?: TaskPortalTheme;
  /** Polling interval while the task hasn't reached a terminal status. */
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

function storageKey(clientId: string) {
  return `misionary-task-portal:${clientId}:lastTaskId`;
}

export function TaskPortal({ apiBaseUrl, clientId, theme, pollIntervalMs = 10000 }: TaskPortalProps) {
  const mergedTheme = { ...DEFAULT_THEME, ...theme };

  const [taskId, setTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [askingStatus, setAskingStatus] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey(clientId));
    if (stored) setTaskId(stored);
  }, [clientId]);

  const { task, error: pollError } = useTaskPolling(apiBaseUrl, taskId, pollIntervalMs);

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
      const created = await createTask(apiBaseUrl, { clientId, title, description, screenshot });
      window.localStorage.setItem(storageKey(clientId), created.id);
      setTaskId(created.id);
      setTitle('');
      setDescription('');
      setScreenshot(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No pudimos enviar tu solicitud');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAskStatus() {
    if (!taskId) return;
    setAskingStatus(true);
    try {
      await askStatus(apiBaseUrl, taskId);
    } catch {
      // polling will surface the current state regardless; this is best-effort
    } finally {
      setAskingStatus(false);
    }
  }

  function handleNewRequest() {
    window.localStorage.removeItem(storageKey(clientId));
    setTaskId(null);
  }

  return (
    <div className="mtp-root" style={cssVars}>
      <style>{STYLES}</style>
      {!taskId ? (
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
            rows={5}
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
      ) : (
        <div className="mtp-status-card">
          <h3 className="mtp-title">{task?.title ?? 'Tu solicitud'}</h3>

          {task ? (
            <>
              <span className={`mtp-badge mtp-badge-${task.status}`}>{STATUS_LABELS[task.status]}</span>
              <p className="mtp-description">{STATUS_DESCRIPTIONS[task.status]}</p>

              {task.status === 'pr_opened' && task.prUrl && (
                <p className="mtp-hint">Tu solución está en revisión antes de publicarse.</p>
              )}

              <div className="mtp-actions">
                <button
                  className="mtp-button mtp-button-secondary"
                  type="button"
                  onClick={handleAskStatus}
                  disabled={askingStatus || isTerminalStatus(task.status)}
                >
                  {askingStatus ? 'Consultando...' : 'Actualizar estado'}
                </button>
                {isTerminalStatus(task.status) && (
                  <button className="mtp-button" type="button" onClick={handleNewRequest}>
                    Reportar otra tarea
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="mtp-description">Cargando estado...</p>
          )}

          {pollError && <p className="mtp-error">{pollError}</p>}
        </div>
      )}
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
  max-width: 420px;
  box-sizing: border-box;
}
.mtp-root * { box-sizing: border-box; }
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
.mtp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.mtp-error { color: #dc2626; font-size: 13px; margin-top: 8px; }
.mtp-description { font-size: 14px; margin: 8px 0; }
.mtp-hint { font-size: 13px; opacity: 0.8; }
.mtp-badge {
  display: inline-block; padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600; background: rgba(79,70,229,0.12); color: var(--mtp-primary);
}
.mtp-badge-failed { background: rgba(220,38,38,0.12); color: #dc2626; }
.mtp-badge-done, .mtp-badge-pr_opened { background: rgba(22,163,74,0.12); color: #16a34a; }
`;
