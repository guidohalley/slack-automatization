import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  slackBotToken: required('SLACK_BOT_TOKEN'),
  slackSigningSecret: required('SLACK_SIGNING_SECRET'),
  // Cursor's Slack app ignores @mentions posted by other bots (no reaction
  // at all, confirmed empirically) - only a real human/user-token message
  // actually triggers it. This user token is used solely for the message
  // that mentions @Cursor; everything else keeps using the bot token.
  slackUserToken: process.env.SLACK_USER_TOKEN ?? '',
  cursorBotId: process.env.CURSOR_BOT_ID ?? '',
  cursorSlackUserId: process.env.CURSOR_SLACK_USER_ID ?? '',
  port: Number(process.env.PORT ?? 3000),
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
