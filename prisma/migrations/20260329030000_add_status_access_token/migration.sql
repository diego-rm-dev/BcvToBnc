-- AlterTable
ALTER TABLE "Order" ADD COLUMN "statusAccessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_statusAccessToken_key" ON "Order"("statusAccessToken");
