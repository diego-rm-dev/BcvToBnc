import { describe, expect, it } from "vitest";
import { buildTransakWidgetParams } from "@/lib/providers/transak-widget-params";

describe("buildTransakWidgetParams", () => {
  it("crea params mínimos con locks de UX", () => {
    const params = buildTransakWidgetParams({
      apiKey: "pk_test",
      referrerDomain: "localhost:3000",
      defaultPaymentMethod: undefined,
      session: {
        partnerOrderId: "order_1",
        walletAddress: "0x1234567890123456789012345678901234567890",
        fiatAmount: 30,
        fiatCurrency: "usd",
        cryptoCurrency: "usdt",
        network: "polygon",
        redirectURL: "https://example.com/status/1"
      }
    });

    expect(params.productsAvailed).toBe("BUY");
    expect(params.hideMenu).toBe(true);
    expect(params.disableWalletAddressForm).toBe(true);
    expect(params.fiatCurrency).toBe("USD");
    expect(params.cryptoCurrencyCode).toBe("USDT");
    expect(params.network).toBe("polygon");
    expect(params.fiatAmount).toBe("30");
  });

  it("incluye email y defaultPaymentMethod cuando están disponibles", () => {
    const params = buildTransakWidgetParams({
      apiKey: "pk_test",
      referrerDomain: "localhost:3000",
      defaultPaymentMethod: "credit_debit_card",
      session: {
        partnerOrderId: "order_2",
        walletAddress: "0x1234567890123456789012345678901234567890",
        email: " user@example.com ",
        fiatAmount: 45,
        fiatCurrency: "USD",
        cryptoCurrency: "USDT",
        network: "bsc",
        redirectURL: "https://example.com/status/2"
      }
    });

    expect(params.email).toBe("user@example.com");
    expect(params.defaultPaymentMethod).toBe("credit_debit_card");
    expect(params.network).toBe("bsc");
  });
});
