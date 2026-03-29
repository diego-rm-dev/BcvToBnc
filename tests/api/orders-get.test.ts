import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: findUniqueMock
    }
  }
}));

import { GET } from "@/app/api/orders/[id]/route";

describe("GET /api/orders/[id]", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("retorna 404 cuando no existe", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/orders/abc?token=valid-token"), {
      params: { id: "abc" }
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Order not found" });
  });

  it("retorna la orden cuando existe", async () => {
    findUniqueMock.mockResolvedValue({
      id: "ord_1",
      status: "PENDING",
      fiatAmount: 30,
      fiatCurrency: "USD",
      cryptoCurrency: "USDT",
      network: "POLYGON",
      walletAddress: "0x1111111111111111111111111111111111111111",
      provider: "TRANSAK",
      createdAt: new Date("2026-03-28T10:00:00.000Z"),
      statusAccessToken: "status-token-1"
    });

    const response = await GET(new Request("http://localhost/api/orders/ord_1?token=status-token-1"), {
      params: { id: "ord_1" }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "ord_1",
      status: "PENDING",
      provider: "TRANSAK",
      createdAt: "2026-03-28T10:00:00.000Z"
    });
  });

  it("retorna 404 si token no coincide", async () => {
    findUniqueMock.mockResolvedValue({
      id: "ord_1",
      status: "PENDING",
      fiatAmount: 30,
      fiatCurrency: "USD",
      cryptoCurrency: "USDT",
      network: "POLYGON",
      walletAddress: "0x1111111111111111111111111111111111111111",
      provider: "TRANSAK",
      createdAt: new Date("2026-03-28T10:00:00.000Z"),
      statusAccessToken: "status-token-1"
    });

    const response = await GET(new Request("http://localhost/api/orders/ord_1?token=otro-token"), {
      params: { id: "ord_1" }
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Order not found" });
  });

  it("retorna 404 si falta token", async () => {
    const response = await GET(new Request("http://localhost/api/orders/ord_1"), {
      params: { id: "ord_1" }
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Order not found" });
  });
});
