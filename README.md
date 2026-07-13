# Client Task Portal → Slack → Cursor Background Agent Bridge

Lets Misionary clients report tasks/bugs from an embeddable widget, have them
turned into Slack threads that trigger a Cursor Background Agent, and get the
result (progress, PR, status) back in the widget without anyone touching
Slack or GitHub directly.

## Structure

- `backend/` — Node.js + TypeScript + Express + Prisma + Slack Bolt. Owns
  the DB, talks to Slack's Web API, and receives Slack's Events API webhook.
- `widget/` — Standalone embeddable React component (`TaskPortal`), built
  with `tsup`, no UI framework dependency beyond React itself.

## End-to-end flow

1. Client fills the widget form (title, description, optional screenshot).
2. Backend posts the report to the client's mapped Slack channel, then a
   follow-up `@Cursor [repo=...] ...` message in the same thread.
3. Cursor reads the thread (including the screenshot via `files:read`),
   works in the background, and replies in-thread with status/PR links.
4. Our Slack app (Events API) listens for those replies, matches them to the
   original task by `thread_ts`, and updates the task's status in Postgres.
5. The widget polls (or subscribes via SSE) and shows a translated,
   non-technical status — never the raw Slack thread.
6. "Actualizar estado" from the widget re-mentions `@Cursor` in the same
   thread, using the same bot identity that created the agent (required for
   Cursor to accept it as a follow-up).

## Backend setup

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET
npm install
npm run prisma:migrate  # creates the ClientTask / TaskEvent / ClientRepoMap tables
npm run dev
```

Required env vars (see `backend/.env.example` for details on each):

- `DATABASE_URL` — Postgres connection string.
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` — our Slack app's credentials.
- `CURSOR_BOT_ID` — Cursor's Slack `bot_id`. Unknown up front; run once,
  read it off the `[slack-events] ignoring message from unrecognized bot_id=...`
  log line for the first Cursor reply, then set it.
- `CURSOR_SLACK_USER_ID` — Cursor's Slack user id, used to build a real
  `<@U...>` mention. Without it, messages fall back to the literal text
  `"@Cursor"`, which will **not** trigger the agent.
- `CORS_ALLOWED_ORIGINS` — comma-separated origins allowed to call the API
  from a browser (the sites embedding the widget).

Before any of this works, you need to seed `ClientRepoMap` rows manually
(one per client) mapping `clientId` → `slackChannelId` + `defaultRepo`. The
widget form never supplies the repo directly — this mapping is the only
source of truth for it.

### Endpoints

| Method | Path                          | Purpose                                             |
|--------|-------------------------------|------------------------------------------------------|
| POST   | `/api/tasks`                  | Create a task, post to Slack, trigger `@Cursor`      |
| GET    | `/api/tasks/:id`               | Poll current status (widget-safe DTO only)           |
| POST   | `/api/tasks/:id/ask-status`    | Re-mention `@Cursor` for a status update              |
| GET    | `/api/tasks/:id/stream`        | SSE alternative to polling                            |
| POST   | `/api/slack/events`            | Slack Events API webhook (signature-verified by Bolt) |

## Widget usage

```bash
cd widget
npm install
npm run build
```

```tsx
import { TaskPortal } from '@misionary/task-portal-widget';

<TaskPortal
  apiBaseUrl="https://api.misionary.com"
  clientId="fenixx"
  theme={{ primaryColor: '#0ea5e9' }}
/>
```

Status is translated to non-technical language internally
(`agent_running` → "Estamos trabajando en tu solicitud", etc.) — raw Slack
text, file names, or diffs are never shown to the client.

## Security notes implemented

- Slack request signature verification is handled by `@slack/bolt`'s
  `ExpressReceiver` on `/api/slack/events` before any handler runs.
- `POST /api/tasks` is rate-limited (10 requests / 15 min) independently
  from polling endpoints, so status polling is never throttled.
- The repo a task targets always comes from `ClientRepoMap`, never from the
  client form.
- Messages matching repo-access-error phrasing are logged distinctly
  (`[slack-events][cursor-repo-access-error]`) for fast debugging.
- The DB row (with `slackThreadTs`) is always persisted **before** the
  `@Cursor` mention is posted, so a failed write can't leave an untracked
  agent running.
- The widget-facing `TaskDto` never includes `slackChannelId`,
  `slackThreadTs`, or raw `TaskEvent` text.

## Known follow-ups / things to confirm operationally

- Draft PRs: confirm whether Cursor opens PRs as draft by default for your
  org, or add "open the PR as draft" explicitly to the prompt in
  `backend/src/routes/tasks.ts`, or PATCH the PR via the GitHub API
  afterwards to force `draft: true`.
- `CURSOR_BOT_ID`/`CURSOR_SLACK_USER_ID` must be discovered once manually
  (see above) — there's no API to look them up ahead of time.
- The SSE endpoint uses an in-memory event bus, fine for a single backend
  process; scale-out behind a load balancer would need Redis pub/sub.
