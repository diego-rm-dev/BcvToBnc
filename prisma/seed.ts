import {
  CryptoCurrency,
  FiatCurrency,
  Network,
  OnRampProvider,
  OrderStatus,
  PrismaClient
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.create({
    data: {
      provider: OnRampProvider.TRANSAK,
      partnerOrderId: "partner_demo_001",
      customerEmail: "paula@example.com",
      walletAddress: "0x1111111111111111111111111111111111111111",
      fiatAmount: 100,
      fiatCurrency: FiatCurrency.USD,
      cryptoCurrency: CryptoCurrency.USDT,
      network: Network.ETHEREUM,
      quotedCryptoAmount: 99.1,
      quotedTotalFee: 0.9,
      status: OrderStatus.PENDING,
      redirectUrl: "https://global-stg.transak.com",
      rawSessionPayload: JSON.stringify({ quoteId: "quote_demo_001" }),
      rawWebhookPayload: null
    }
  });

  console.log(`Seed OK. Order id: ${order.id}`);
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
