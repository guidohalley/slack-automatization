-- Add nullable reporterName to ClientTask (no backfill needed - nullable)
ALTER TABLE "ClientTask" ADD COLUMN "reporterName" TEXT;
