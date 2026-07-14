-- Add assigneeName to ClientRepoMap (defaulted, so existing rows fill in automatically)
ALTER TABLE "ClientRepoMap" ADD COLUMN "assigneeName" TEXT NOT NULL DEFAULT 'Guido Halley';

-- Add assigneeName to ClientTask, backfill existing rows, then enforce NOT NULL
ALTER TABLE "ClientTask" ADD COLUMN "assigneeName" TEXT;
UPDATE "ClientTask" SET "assigneeName" = 'Guido Halley' WHERE "assigneeName" IS NULL;
ALTER TABLE "ClientTask" ALTER COLUMN "assigneeName" SET NOT NULL;
