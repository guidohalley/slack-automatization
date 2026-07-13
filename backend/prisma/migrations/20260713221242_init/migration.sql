-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'agent_running', 'pr_opened', 'done', 'failed');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('cursor_bot', 'client', 'system');

-- CreateTable
CREATE TABLE "ClientTask" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "screenshotUrl" TEXT,
    "slackChannelId" TEXT NOT NULL,
    "slackThreadTs" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "prUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "source" "EventSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRepoMap" (
    "clientId" TEXT NOT NULL,
    "slackChannelId" TEXT NOT NULL,
    "defaultRepo" TEXT NOT NULL,

    CONSTRAINT "ClientRepoMap_pkey" PRIMARY KEY ("clientId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientTask_slackThreadTs_key" ON "ClientTask"("slackThreadTs");

-- CreateIndex
CREATE INDEX "ClientTask_clientId_idx" ON "ClientTask"("clientId");

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_idx" ON "TaskEvent"("taskId");

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ClientTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
