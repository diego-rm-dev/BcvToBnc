-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "partnerOrderId" TEXT,
    "orderId" TEXT,
    "rawPayload" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_provider_processedAt_idx" ON "ProcessedWebhookEvent"("provider", "processedAt");

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_orderId_idx" ON "ProcessedWebhookEvent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedWebhookEvent_provider_eventId_key" ON "ProcessedWebhookEvent"("provider", "eventId");
