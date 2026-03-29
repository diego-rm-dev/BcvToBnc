import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  findFirstMock,
  updateMock,
  processedCreateMock,
  transactionMock,
  decodeMock
} = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  updateMock: vi.fn(),
  processedCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  decodeMock: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findFirst: findFirstMock,
      update: updateMock
    },
    processedWebhookEvent: {
      create: processedCreateMock
    },
    $transaction: transactionMock
  }
}));

vi.mock("@/lib/providers/transak", () => ({
  decodeTransakOrderWebhookData: decodeMock,
  mapTransakStatus: vi.fn(({ status }: { status?: string }) => {
    const normalized = status?.toUpperCase();
    if (normalized === "SUCCESS" || normalized === "COMPLETED") return "COMPLETED";
    if (normalized === "AWAITING_PAYMENT_FROM_USER") return "WAITING_PAYMENT";
    return "PROCESSING";
  })
}));

import { POST } from "@/app/api/webhooks/transak/route";

describe("POST /api/webhooks/transak", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
    processedCreateMock.mockReset();
    transactionMock.mockReset();
    decodeMock.mockReset();
    vi.unstubAllEnvs();

    transactionMock.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        processedWebhookEvent: { create: processedCreateMock },
        order: { update: updateMock }
      })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("procesa evento nuevo y actualiza order", async () => {
    decodeMock.mockReturnValue({
      webhookData: { partnerOrderId: "p_2", status: "AWAITING_PAYMENT_FROM_USER", id: "tx_2" }
    });
    findFirstMock.mockResolvedValue({
      id: "ord_2",
      status: "PENDING",
      rawWebhookPayload: "{}"
    });
    processedCreateMock.mockResolvedValue({ id: "evt_1" });
    updateMock.mockResolvedValue({ id: "ord_2" });

    const response = await POST(
      new Request("http://localhost/api/webhooks/transak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventID: "ORDER_CREATED", data: "jwt-token-2" })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      processed: true,
      duplicate: false,
      orderId: "ord_2",
      status: "WAITING_PAYMENT",
      eventId: "ORDER_CREATED"
    });
    expect(processedCreateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("ignora duplicado por eventId único y no reprocesa side effects", async () => {
    decodeMock.mockReturnValue({
      webhookData: { partnerOrderId: "p_1", status: "COMPLETED", id: "tx_1" }
    });
    findFirstMock.mockResolvedValue({
      id: "ord_1",
      status: "PENDING",
      rawWebhookPayload: "{}"
    });

    // Simula colisión UNIQUE(provider,eventId) de Prisma.
    processedCreateMock.mockRejectedValue({ code: "P2002" });

    const response = await POST(
      new Request("http://localhost/api/webhooks/transak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventID: "ORDER_COMPLETED", data: "jwt-token" })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      processed: false,
      duplicate: true,
      orderId: "ord_1",
      eventId: "ORDER_COMPLETED"
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("si no cambia estado, registra evento y evita update redundante", async () => {
    decodeMock.mockReturnValue({
      webhookData: { partnerOrderId: "p_3", status: "COMPLETED", id: "tx_3" }
    });

    const payload = JSON.stringify({ eventID: "ORDER_COMPLETED", data: "jwt-token-3" });
    findFirstMock.mockResolvedValue({
      id: "ord_3",
      status: "COMPLETED",
      rawWebhookPayload: payload
    });
    processedCreateMock.mockResolvedValue({ id: "evt_3" });

    const response = await POST(
      new Request("http://localhost/api/webhooks/transak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      processed: true,
      duplicate: false,
      orderId: "ord_3",
      eventId: "ORDER_COMPLETED"
    });

    expect(processedCreateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("en producción rechaza JWT inválido", async () => {
    vi.stubEnv("NODE_ENV", "production");
    decodeMock.mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    const response = await POST(
      new Request("http://localhost/api/webhooks/transak", {
        method: "POST",
        body: JSON.stringify({ eventID: "ORDER_CREATED", data: "bad-jwt" })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_webhook_jwt" });
  });
});
