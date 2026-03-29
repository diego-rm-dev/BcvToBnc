import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/providers/transak", () => ({
  getTransakPriceQuote: vi.fn()
}));

import { getTransakPriceQuote } from "@/lib/providers/transak";
import { estimateGrossFiatForTargetNetCrypto } from "@/lib/services/estimation";

const mockedGetQuote = vi.mocked(getTransakPriceQuote);

describe("estimateGrossFiatForTargetNetCrypto", () => {
  beforeEach(() => {
    mockedGetQuote.mockReset();
  });

  it("estima fiat bruto para aproximar neto objetivo", async () => {
    mockedGetQuote.mockImplementation(async ({ cryptoAmount }) => ({
      provider: "TRANSAK",
      quoteTimestamp: new Date().toISOString(),
      quoteId: "quote-1",
      fiatAmount: 30,
      fiatCurrency: "USD",
      cryptoCurrency: "USDT",
      network: "polygon",
      estimatedCryptoAmount: cryptoAmount ?? null,
      estimatedTotalFee: 1,
      input: {
        fiatCurrency: "USD",
        cryptoCurrency: "USDT",
        network: "polygon",
        isBuyOrSell: "BUY",
        fiatAmount: null,
        cryptoAmount: cryptoAmount ?? null,
        paymentMethod: null,
        quoteCountryCode: null
      },
      summary: {
        quoteId: "quote-1",
        fiatAmount: 30,
        cryptoAmount: cryptoAmount ?? null,
        totalFee: 1,
        conversionPrice: null,
        marketConversionPrice: null,
        paymentMethod: null,
        slippage: null
      },
      raw: { mocked: true }
    }));

    const result = await estimateGrossFiatForTargetNetCrypto({
      targetNetCryptoAmount: 30,
      fiatCurrency: "USD",
      cryptoCurrency: "USDT",
      network: "polygon"
    });

    expect(result.recommendedFiatAmount).toBeGreaterThan(30);
    expect(result.estimatedNetCryptoAmount).toBe(30);
    expect(result.strategy).toBe("quote_crypto_target");
  });

  it("usa fallback cuando no hay quote útil", async () => {
    mockedGetQuote.mockResolvedValue({
      provider: "TRANSAK",
      quoteTimestamp: new Date().toISOString(),
      quoteId: null,
      fiatAmount: null,
      fiatCurrency: "USD",
      cryptoCurrency: "USDT",
      network: "polygon",
      estimatedCryptoAmount: null,
      estimatedTotalFee: null,
      input: {
        fiatCurrency: "USD",
        cryptoCurrency: "USDT",
        network: "polygon",
        isBuyOrSell: "BUY",
        fiatAmount: null,
        cryptoAmount: 30,
        paymentMethod: null,
        quoteCountryCode: null
      },
      summary: {
        quoteId: null,
        fiatAmount: null,
        cryptoAmount: null,
        totalFee: null,
        conversionPrice: null,
        marketConversionPrice: null,
        paymentMethod: null,
        slippage: null
      },
      raw: { mocked: true }
    });

    const result = await estimateGrossFiatForTargetNetCrypto({
      targetNetCryptoAmount: 30,
      fiatCurrency: "USD",
      cryptoCurrency: "USDT",
      network: "polygon"
    });

    expect(result.strategy).toBe("fallback");
    expect(result.recommendedFiatAmount).toBe(30);
  });

  it("usa fallback cuando la API de quote falla", async () => {
    mockedGetQuote.mockRejectedValue(new Error("provider_unavailable"));

    const result = await estimateGrossFiatForTargetNetCrypto({
      targetNetCryptoAmount: 30,
      fiatCurrency: "USD",
      cryptoCurrency: "USDT",
      network: "polygon",
      initialFiatAmount: 35
    });

    expect(result.strategy).toBe("fallback");
    expect(result.recommendedFiatAmount).toBe(35);
    expect(result.quoteUsed).toBeNull();
  });
});
