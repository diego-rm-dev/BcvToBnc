-- AlterTable
ALTER TABLE "Order" ADD COLUMN "quoteInput" TEXT;
ALTER TABLE "Order" ADD COLUMN "quoteRequestedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "quoteSummary" TEXT;
