import type { App } from '@slack/bolt';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { parseCursorMessage } from '../lib/statusParser';
import { taskUpdated } from '../lib/eventBus';

interface SlackMessageEvent {
  subtype?: string;
  bot_id?: string;
  thread_ts?: string;
  text?: string;
  ts: string;
}

// Signature verification (X-Slack-Signature + timestamp) is handled by
// Bolt's ExpressReceiver before this handler ever runs.
export function registerSlackEventHandlers(app: App) {
  app.event('message', async ({ event }) => {
    const msg = event as unknown as SlackMessageEvent;

    if (!msg.thread_ts) return; // only threaded replies correlate to a task
    if (!msg.bot_id) return; // human reply in-thread, not Cursor

    if (msg.bot_id !== env.cursorBotId) {
      // First-time setup: there is no way to know Cursor's bot_id ahead of
      // time, so inspect this log line once and set CURSOR_BOT_ID from it.
      console.log(
        `[slack-events] ignoring message from unrecognized bot_id=${msg.bot_id} (set CURSOR_BOT_ID to stop ignoring it)`,
      );
      return;
    }

    const task = await prisma.clientTask.findUnique({ where: { slackThreadTs: msg.thread_ts } });
    if (!task) return; // thread we don't recognize

    const rawText = msg.text ?? '';

    // Persisted unconditionally, whether or not it can be parsed below, so
    // nothing is lost for debugging.
    await prisma.taskEvent.create({
      data: { taskId: task.id, rawText, source: 'cursor_bot' },
    });

    const parsed = parseCursorMessage(rawText);

    if (parsed.isRepoAccessError) {
      console.warn(
        `[slack-events][cursor-repo-access-error] task=${task.id} repo=${task.repo} text=${JSON.stringify(rawText)}`,
      );
    }

    if (parsed.status) {
      await prisma.clientTask.update({
        where: { id: task.id },
        data: {
          status: parsed.status,
          ...(parsed.prUrl ? { prUrl: parsed.prUrl } : {}),
        },
      });
      taskUpdated(task.id);
    }
  });
}
