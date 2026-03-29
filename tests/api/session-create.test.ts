import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createMock,
  updateMock,
  createSessionMock,
  estimateMock,
  applyRateLimitMock,
  assertAllowedOriginMock,
  getClientIpMock,
  corsHeadersMock
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  createSessionMock: vi.fn(),
  estimateMock: vi.fn(),
  applyRateLimitMock: vi.fn(),
  assertAllowedOriginMock: vi.fn(),
  getClientIpMock: vi.fn(),
  corsHeadersMock: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      create: createMock,
      update: updateMock
    }
  }
}));

vi.mock("@/lib/providers/transak", () => ({
  createTransakSession: createSessionMock
}));

vi.mock("@/lib/services/estimation", () => ({
  estimateGrossFiatForTargetNetCrypto: estimateMock
}));

vi.mock("@/lib/security/rate-limit", () => ({
  applyRateLimit: applyRateLimitMock
}));

vi.mock("@/lib/security/request", () => ({
  assertAllowedOrigin: assertAllowedOriginMock,
  getClientIp: getClientIpMock,
  corsHeaders: corsHeadersMock
}));

import { POST } from "@/app/api/session/create/route";

describe("POST /api/session/create", () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    createSessionMock.mockReset();
    estimateMock.mockReset();
    applyRateLimitMock.mockReset();
    assertAllowedOriginMock.mockReset();
    getClientIpMock.mockReset();
    corsHeadersMock.mockReset();

    applyRateLimitMock.mockReturnValue({ allowed: true, resetAt: Date.now() + 60_000 });
    getClientIpMock.mockReturnValue("127.0.0.1");
    corsHeadersMock.mockReturnValue({});
  });

  it("crea sesión exitosamente con widgetUrl realista", async () => {
    createMock.mockResolvedValue({ id: "ord_1" });

    createSessionMock.mockResolvedValue({
      provider: "TRANSAK",
      status: "WAITING_PAYMENT",
      redirectUrl: "https://global-stg.transak.com?session=abc",
      widgetUrl: "https://global-stg.transak.com?session=abc",
      raw: {
        data: { widgetUrl: "https://global-stg.transak.com?session=abc" },
        metadata: { expiresInMinutes: 5, singleUse: true }
      }
    });

    updateMock.mockResolvedValue({
      id: "ord_1",
      partnerOrderId: "po_1",
      provider: "TRANSAK",
      redirectUrl: "https://global-stg.transak.com?session=abc",
      status: "WAITING_PAYMENT"
    });

    const response = await POST(
      new Request("http://localhost/api/session/create", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({
          walletAddress: "0x1111111111111111111111111111111111111111",
          email: "paula@example.com",
          fiatAmount: 30,
          network: "polygon"
        })
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      orderId: string;
      provider: string;
      widgetUrl: string;
      status: string;
      statusAccessToken: string;
      statusUrl: string;
    };
    expect(body).toMatchObject({
      orderId: "ord_1",
      provider: "TRANSAK",
      widgetUrl: "https://global-stg.transak.com?session=abc",
      status: "WAITING_PAYMENT"
    });
    expect(body.statusAccessToken).toHaveLength(64);
    expect(body.statusUrl).toContain(`/paula/status/ord_1?token=${body.statusAccessToken}`);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0]?.data?.statusAccessToken).toHaveLength(64);
  });

  it("persiste rawSessionPayload con metadata efímera", async () => {
    createMock.mockResolvedValue({ id: "ord_2" });

    createSessionMock.mockResolvedValue({
      provider: "TRANSAK",
      status: "WAITING_PAYMENT",
      redirectUrl: "https://global-stg.transak.com?session=single-use",
      widgetUrl: "https://global-stg.transak.com?session=single-use",
      raw: {
        data: { widgetUrl: "https://global-stg.transak.com?session=single-use" },
        metadata: {
          endpoint: "/api/v2/auth/session",
          expiresInMinutes: 5,
          singleUse: true,
          warning: "Never reuse widgetUrl/sessionId for a new flow."
        }
      }
    });

    updateMock.mockResolvedValue({
      id: "ord_2",
      partnerOrderId: "po_2",
      provider: "TRANSAK",
      redirectUrl: "https://global-stg.transak.com?session=single-use",
      status: "WAITING_PAYMENT"
    });

    await POST(
      new Request("http://localhost/api/session/create", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({
          walletAddress: "0x1111111111111111111111111111111111111111",
          fiatAmount: 30,
          network: "polygon"
        })
      })
    );

    const updateArgs = updateMock.mock.calls[0]?.[0];
    expect(updateArgs).toBeDefined();

    const rawSessionPayload = updateArgs.data.rawSessionPayload as string;
    const parsed = JSON.parse(rawSessionPayload) as { providerSession: { metadata?: { singleUse?: boolean } } };

    expect(parsed.providerSession.metadata?.singleUse).toBe(true);
  });

  it("degrada con elegancia cuando estimation falla por quote", async () => {
    estimateMock.mockResolvedValue({
      targetNetCryptoAmount: 30,
      recommendedFiatAmount: 30,
      estimatedNetCryptoAmount: null,
      estimatedGrossCryptoAmount: null,
      estimatedTotalFeeFiat: null,
      estimatedTotalFeeCrypto: null,
      marginPct: 0.03,
      isEstimate: true,
      disclaimer: "Estimación basada en cotización pública de Transak.",
      quoteRequestedAt: null,
      quoteInput: null,
      quoteOutputSummary: null,
      quoteUsed: null,
      strategy: "fallback"
    });

    createMock.mockResolvedValue({ id: "ord_3" });
    createSessionMock.mockResolvedValue({
      provider: "TRANSAK",
      status: "WAITING_PAYMENT",
      redirectUrl: "https://global-stg.transak.com?session=fallback",
      widgetUrl: "https://global-stg.transak.com?session=fallback",
      raw: { metadata: { singleUse: true } }
    });
    updateMock.mockResolvedValue({
      id: "ord_3",
      partnerOrderId: "po_3",
      provider: "TRANSAK",
      redirectUrl: "https://global-stg.transak.com?session=fallback",
      status: "WAITING_PAYMENT"
    });

    const response = await POST(
      new Request("http://localhost/api/session/create", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({
          walletAddress: "0x1111111111111111111111111111111111111111",
          network: "polygon",
          targetNetCryptoAmount: 30,
          fiatAmount: 30
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      orderId: "ord_3",
      status: "WAITING_PAYMENT",
      estimate: {
        targetNetCryptoAmount: 30,
        estimatedFiatAmount: 30,
        strategy: "fallback"
      }
    });
  });
});
