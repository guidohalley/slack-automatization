import type { TaskStatus } from '@prisma/client';

const PR_URL_REGEX = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/;
const REPO_ACCESS_ERROR_REGEX = /\b(no access|does not have access|repository not found|permission denied)\b/i;
const FAILURE_KEYWORDS_REGEX = /\b(error|failed|couldn't|could not|unable to)\b/i;
const DONE_KEYWORDS_REGEX = /\b(merged|marked as done|completed)\b/i;
const RUNNING_KEYWORDS_REGEX = /\b(working on it|starting|running|in progress|cloning)\b/i;

export interface ParsedCursorMessage {
  status?: TaskStatus;
  prUrl?: string;
  isRepoAccessError: boolean;
}

// Deliberately simple regex-based parsing, per spec: this only needs to
// catch the common phrasings Cursor's bot uses, not fully understand text.
// Any message that doesn't match anything below is still persisted as a raw
// TaskEvent by the caller, so nothing is silently dropped.
export function parseCursorMessage(text: string): ParsedCursorMessage {
  const isRepoAccessError = REPO_ACCESS_ERROR_REGEX.test(text);

  const prMatch = text.match(PR_URL_REGEX);
  if (prMatch) {
    return { status: 'pr_opened', prUrl: prMatch[0], isRepoAccessError };
  }

  if (isRepoAccessError || FAILURE_KEYWORDS_REGEX.test(text)) {
    return { status: 'failed', isRepoAccessError };
  }

  if (DONE_KEYWORDS_REGEX.test(text)) {
    return { status: 'done', isRepoAccessError };
  }

  if (RUNNING_KEYWORDS_REGEX.test(text)) {
    return { status: 'agent_running', isRepoAccessError };
  }

  return { isRepoAccessError };
}
