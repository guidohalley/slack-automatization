import { env } from './lib/env';
import { expressApp, slackApp } from './app';

(async () => {
  await slackApp.start(env.port);
  console.log(`Backend listening on port ${env.port}`);
  console.log(`Slack events endpoint: POST /api/slack/events`);
  console.log(`Task API: POST /api/tasks, GET /api/tasks/:id, POST /api/tasks/:id/ask-status`);
})();

export { expressApp };
