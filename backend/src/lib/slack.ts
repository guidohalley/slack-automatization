import { WebClient } from '@slack/web-api';
import { env } from './env';

export const slackClient = new WebClient(env.slackBotToken);
// Cursor's Slack app silently ignores @mentions posted by other bots (no
// reaction whatsoever, confirmed by testing). Falls back to the bot client
// if unset, which will keep reproducing that same silence.
export const slackUserClient = new WebClient(env.slackUserToken || env.slackBotToken);

export interface InitialMessageResult {
  threadTs: string;
}

export async function postInitialMessage(
  channelId: string,
  title: string,
  description: string,
  reporterName: string | null,
): Promise<InitialMessageResult> {
  const reportedBy = reporterName ? `\n_Reportado por ${reporterName}_` : '';
  const result = await slackClient.chat.postMessage({
    channel: channelId,
    text: `Nueva tarea de cliente: ${title}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${title}*\n${description}${reportedBy}` },
      },
    ],
  });

  if (!result.ts) {
    throw new Error('Slack did not return a message ts for the initial message');
  }

  return { threadTs: result.ts };
}

// Slack's Block Kit image block needs a URL Slack's servers can fetch
// unauthenticated, which a private file upload is not. So the screenshot is
// posted as its own threaded reply (with the file itself, not a link) right
// after the initial message, instead of being embedded inline in it. Cursor
// still sees it as part of the same thread via files:read.
export async function uploadScreenshotToThread(
  channelId: string,
  threadTs: string,
  fileBuffer: Buffer,
  filename: string,
): Promise<string | null> {
  const result = await slackClient.files.uploadV2({
    channel_id: channelId,
    thread_ts: threadTs,
    file: fileBuffer,
    filename,
  });

  // uploadV2's response shape nests the uploaded file info under different
  // keys depending on SDK version; permalink is best-effort for display only.
  const files = (result as { files?: Array<{ files?: Array<{ permalink?: string }> }> }).files;
  const permalink = files?.[0]?.files?.[0]?.permalink;
  return permalink ?? null;
}

export async function postCursorMention(
  channelId: string,
  threadTs: string,
  repo: string,
  instruction: string,
) {
  // A real Slack mention that notifies/triggers an app must use the
  // <@USER_ID> syntax; plain "@Cursor" text is inert. Falls back to the
  // literal text (useful for local testing) if CURSOR_SLACK_USER_ID isn't set.
  const mention = env.cursorSlackUserId ? `<@${env.cursorSlackUserId}>` : '@Cursor';
  // Cursor parses the repo from natural language (its own docs example:
  // "@Cursor Fix the login bug in torvalds/linux using Composer"), not from
  // a "[repo=...]" tag - that bracket syntax was never a real Cursor command.
  const text = `${mention} In the ${repo} repo: ${instruction}`;

  return slackUserClient.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    text,
  });
}
