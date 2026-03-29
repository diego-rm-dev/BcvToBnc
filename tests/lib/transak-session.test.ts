import { beforeEach, describe, expect, it, vi } from "vitest";

describe("createTransakSession", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  async function loadWithConfig(configOverrides: {
    apiKey?: string;
    partnerAccessToken?: string;
    defaultPaymentMethod?: string;
  }) {
    vi.resetModules();
    vi.doMock("@/lib/config", () => ({
      config: {
        transak: {
          apiKey: configOverrides.apiKey,
          partnerAccessToken: configOverrides.partnerAccessToken,
          referrerDomain: "localhost:3000",
          defaultPaymentMethod: configOverrides.defaultPaymentMethod,
          createWidgetSessionEndpoint: "https://api-gateway-stg.transak.com/api/v2/auth/session",
          webhookAccessToken: "webhook-token",
          quoteEndpoint: "https://api-stg.transak.com/api/v1/pricing/public/quotes"
        }
      }
    }));

    return import("@/lib/providers/transak");
  }

  it("falla si falta API key", async () => {
    const { createTransakSession } = await loadWithConfig({
      apiKey: undefined,
      partnerAccessToken: "token"
    });

    await expect(
      createTransakSession({
        partnerOrderId: "po_1",
        walletAddress: "0x1111111111111111111111111111111111111111",
        fiatAmount: 30,
        fiatCurrency: "USD",
        cryptoCurrency: "USDT",
        network: "polygon",
        redirectURL: "https://example.com/status/1"
      })
    ).rejects.toMatchObject({ message: "Missing TRANSAK_API_KEY" });
  });

  it("falla si falta access token", async () => {
    const { createTransakSession } = await loadWithConfig({
      apiKey: "pk_test",
      partnerAccessToken: undefined
    });

    await expect(
      createTransakSession({
        partnerOrderId: "po_2",
        walletAddress: "0x1111111111111111111111111111111111111111",
        fiatAmount: 30,
        fiatCurrency: "USD",
        cryptoCurrency: "USDT",
        network: "polygon",
        redirectURL: "https://example.com/status/2"
      })
    ).rejects.toMatchObject({ message: "Missing TRANSAK_PARTNER_ACCESS_TOKEN" });
  });

  it("retorna widgetUrl y la marca como single-use/efímera", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: { widgetUrl: "https://global-stg.transak.com?session=one" }
          })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: { widgetUrl: "https://global-stg.transak.com?session=two" }
          })
      } as Response);

    const { createTransakSession } = await loadWithConfig({
      apiKey: "pk_test",
      partnerAccessToken: "token",
      defaultPaymentMethod: "credit_debit_card"
    });

    const input = {
      partnerOrderId: "po_3",
      walletAddress: "0x1111111111111111111111111111111111111111",
      email: "paula@example.com",
      fiatAmount: 30,
      fiatCurrency: "USD",
      cryptoCurrency: "USDT",
      network: "polygon",
      redirectURL: "https://example.com/status/3"
    } as const;

    const first = await createTransakSession(input);
    const second = await createTransakSession({ ...input, partnerOrderId: "po_4" });

    expect(first.widgetUrl).toBe("https://global-stg.transak.com?session=one");
    expect(second.widgetUrl).toBe("https://global-stg.transak.com?session=two");
    expect(first.widgetUrl).not.toBe(second.widgetUrl);

    expect((first.raw as { metadata?: { singleUse?: boolean; expiresInMinutes?: number } }).metadata?.singleUse).toBe(true);
    expect((first.raw as { metadata?: { singleUse?: boolean; expiresInMinutes?: number } }).metadata?.expiresInMinutes).toBe(5);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
