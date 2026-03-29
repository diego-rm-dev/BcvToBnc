-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'TRANSAK',
    "partnerOrderId" TEXT,
    "customerEmail" TEXT,
    "walletAddress" TEXT NOT NULL,
    "fiatAmount" REAL NOT NULL,
    "fiatCurrency" TEXT NOT NULL DEFAULT 'USD',
    "cryptoCurrency" TEXT NOT NULL DEFAULT 'USDT',
    "network" TEXT NOT NULL DEFAULT 'ETHEREUM',
    "quotedCryptoAmount" REAL,
    "quotedTotalFee" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "redirectUrl" TEXT,
    "rawSessionPayload" TEXT,
    "rawWebhookPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_walletAddress_createdAt_idx" ON "Order"("walletAddress", "createdAt");

-- CreateIndex
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");

-- CreateIndex
CREATE INDEX "Order_provider_createdAt_idx" ON "Order"("provider", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_provider_partnerOrderId_key" ON "Order"("provider", "partnerOrderId");
