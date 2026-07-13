import express from 'express';
import cors from 'cors';
import { App as BoltApp, ExpressReceiver } from '@slack/bolt';
import { env } from './lib/env';
import { tasksRouter } from './routes/tasks';
import { registerSlackEventHandlers } from './routes/slackEvents';

// ExpressReceiver gives us a plain Express app under the hood, so REST
// routes and the Slack Events API endpoint can share one HTTP server. Bolt
// wires its own raw-body/signature-verification middleware for
// SLACK_EVENTS_PATH at construction time, before any of our own middleware
// is registered below, so it never competes with express.json().
const SLACK_EVENTS_PATH = '/api/slack/events';

const receiver = new ExpressReceiver({
  signingSecret: env.slackSigningSecret,
  endpoints: SLACK_EVENTS_PATH,
});

export const slackApp = new BoltApp({
  token: env.slackBotToken,
  receiver,
});

registerSlackEventHandlers(slackApp);

export const expressApp = receiver.app;

expressApp.get('/healthz', (_req, res) => res.json({ ok: true }));

expressApp.use(
  '/api/tasks',
  cors({ origin: env.corsAllowedOrigins.length ? env.corsAllowedOrigins : false }),
  express.json({ limit: '2mb' }),
  tasksRouter,
);
