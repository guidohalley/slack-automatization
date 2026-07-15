import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { getClientRepoMapping } from '../lib/repoMap';
import { postInitialMessage, uploadScreenshotToThread, postCursorMention } from '../lib/slack';
import { toTaskDto } from '../lib/taskDto';
import { taskUpdated, onTaskUpdated } from '../lib/eventBus';

export const tasksRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Scoped to task creation only: GET /:id and the SSE stream are polled
// every ~10s by the widget and must not be throttled by this.
const taskCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many task submissions, please try again later.' },
});

tasksRouter.post('/', taskCreationLimiter, upload.single('screenshot'), async (req, res) => {
  const { clientId, title, description, reporterName } = req.body as Record<string, unknown>;

  if (typeof clientId !== 'string' || !clientId.trim()) {
    return res.status(400).json({ error: 'clientId is required' });
  }
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }
  // Optional: only present when the embedding system has a logged-in user
  // to tell us. Never trusted for anything beyond display.
  const reporter =
    typeof reporterName === 'string' && reporterName.trim() ? reporterName.trim().slice(0, 200) : null;

  // repo/channel always come from the internal mapping, never from the form.
  const mapping = await getClientRepoMapping(clientId);
  if (!mapping) {
    return res.status(400).json({ error: 'Unknown client' });
  }

  let threadTs: string;
  try {
    const initial = await postInitialMessage(mapping.slackChannelId, title, description, reporter);
    threadTs = initial.threadTs;
  } catch (err) {
    console.error('[tasks] failed to post initial Slack message', err);
    return res.status(502).json({ error: 'Could not reach Slack' });
  }

  let screenshotUrl: string | null = null;
  if (req.file) {
    try {
      screenshotUrl = await uploadScreenshotToThread(
        mapping.slackChannelId,
        threadTs,
        req.file.buffer,
        req.file.originalname,
      );
    } catch (err) {
      console.error('[tasks] failed to upload screenshot, continuing without it', err);
    }
  }

  // Persist before mentioning @Cursor: if this insert fails, no agent gets
  // triggered without a DB record tracking it.
  const task = await prisma.clientTask.create({
    data: {
      clientId,
      title,
      description,
      screenshotUrl,
      slackChannelId: mapping.slackChannelId,
      slackThreadTs: threadTs,
      repo: mapping.defaultRepo,
      assigneeName: mapping.assigneeName,
      reporterName: reporter,
      status: 'pending',
    },
  });

  await prisma.taskEvent.create({
    data: { taskId: task.id, rawText: 'Task created, Slack thread started.', source: 'system' },
  });

  try {
    await postCursorMention(
      mapping.slackChannelId,
      threadTs,
      mapping.defaultRepo,
      `A client reported an issue. Please investigate and fix it, then open a pull request.\n\nTitle: ${title}\nDescription: ${description}`,
    );
    const updated = await prisma.clientTask.update({
      where: { id: task.id },
      data: { status: 'agent_running' },
    });
    await prisma.taskEvent.create({
      data: { taskId: task.id, rawText: 'Mentioned @Cursor to trigger background agent.', source: 'system' },
    });
    taskUpdated(task.id);
    return res.status(201).json(toTaskDto(updated));
  } catch (err) {
    console.error('[tasks] failed to mention @Cursor', err);
    const failed = await prisma.clientTask.update({
      where: { id: task.id },
      data: { status: 'failed' },
    });
    await prisma.taskEvent.create({
      data: { taskId: task.id, rawText: `Failed to trigger @Cursor: ${String(err)}`, source: 'system' },
    });
    taskUpdated(task.id);
    return res.status(201).json(toTaskDto(failed));
  }
});

// Widget-facing list: all tasks reported for a client, newest first. There's
// no per-user identity in this system, so this is a shared list scoped only
// by clientId (matches the "internal team issue board" use case).
tasksRouter.get('/', async (req, res) => {
  const { clientId } = req.query;
  if (typeof clientId !== 'string' || !clientId.trim()) {
    return res.status(400).json({ error: 'clientId is required' });
  }

  const tasks = await prisma.clientTask.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(tasks.map(toTaskDto));
});

tasksRouter.get('/:id', async (req, res) => {
  const task = await prisma.clientTask.findUnique({ where: { id: req.params.id } });
  if (!task) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.json(toTaskDto(task));
});

tasksRouter.post('/:id/ask-status', async (req, res) => {
  const task = await prisma.clientTask.findUnique({ where: { id: req.params.id } });
  if (!task) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    // Reuses the same Slack app/token that created the agent, posting into
    // the same thread, so Cursor accepts this as a follow-up from the owner.
    await postCursorMention(
      task.slackChannelId,
      task.slackThreadTs,
      task.repo,
      'Can you share a status update on this task? If a pull request already exists, include the link.',
    );
    await prisma.taskEvent.create({
      data: { taskId: task.id, rawText: 'Client requested a status update.', source: 'client' },
    });
    return res.json(toTaskDto(task));
  } catch (err) {
    console.error('[tasks] failed to ask for status', err);
    return res.status(502).json({ error: 'Could not reach Slack' });
  }
});

// Phase 2 (optional): push-based alternative to polling GET /:id.
tasksRouter.get('/:id/stream', async (req, res) => {
  const taskId = req.params.id;
  const task = await prisma.clientTask.findUnique({ where: { id: taskId } });
  if (!task) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write(`data: ${JSON.stringify(toTaskDto(task))}\n\n`);

  const unsubscribe = onTaskUpdated(taskId, async () => {
    const fresh = await prisma.clientTask.findUnique({ where: { id: taskId } });
    if (fresh) {
      res.write(`data: ${JSON.stringify(toTaskDto(fresh))}\n\n`);
    }
  });

  const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});
