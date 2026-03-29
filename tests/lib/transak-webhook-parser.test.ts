import { describe, expect, it } from "vitest";
import {
  extractTransakWebhookData,
  mapExternalStatusToOrderStatus,
  parseTransakOrderWebhookEnvelope
} from "@/lib/webhooks/transak";

describe("transak webhook parser", () => {
  it("parsea envelope y extrae partnerOrderId/status de payload decriptado", () => {
    const envelope = parseTransakOrderWebhookEnvelope({
      eventID: "ORDER_COMPLETED",
      data: "jwt.token.payload"
    });

    const parsed = extractTransakWebhookData(envelope, {
      webhookData: {
        id: "transak-order-1",
        partnerOrderId: "po_123",
        status: "COMPLETED"
      }
    });

    expect(parsed.envelope.eventId).toBe("ORDER_COMPLETED");
    expect(parsed.envelope.dataJwt).toBe("jwt.token.payload");
    expect(parsed.partnerOrderId).toBe("po_123");
    expect(parsed.providerReference).toBe("transak-order-1");
    expect(parsed.externalStatus).toBe("COMPLETED");
  });

  it("mapea estados externos a internos del dominio", () => {
    expect(mapExternalStatusToOrderStatus("AWAITING_PAYMENT_FROM_USER")).toBe("WAITING_PAYMENT");
    expect(mapExternalStatusToOrderStatus("PROCESSING")).toBe("PROCESSING");
    expect(mapExternalStatusToOrderStatus("COMPLETED")).toBe("COMPLETED");
    expect(mapExternalStatusToOrderStatus("FAILED")).toBe("FAILED");
    expect(mapExternalStatusToOrderStatus("EXPIRED")).toBe("EXPIRED");
  });
});
