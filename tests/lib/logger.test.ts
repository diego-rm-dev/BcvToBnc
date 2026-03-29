import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, sanitizeLogValue } from "@/lib/logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sanitiza campos sensibles por nombre de llave", () => {
    const input = {
      apiKey: "pk_live_1234567890",
      nested: {
        token: "tok_1234567890",
        walletAddress: "0x1111111111111111111111111111111111111111"
      }
    };

    const sanitized = sanitizeLogValue(input) as {
      apiKey: string;
      nested: { token: string; walletAddress: string };
    };

    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect(sanitized.nested.token).toBe("[REDACTED]");
    expect(sanitized.nested.walletAddress).toBe("0x1111111111111111111111111111111111111111");
  });

  it("imprime línea JSON estructurada para eventos con requestId", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.event("info", "session_create_started", {
      requestId: "req_123",
      metadata: {
        partnerOrderId: "po_123",
        accessToken: "sensitive_value"
      }
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const raw = infoSpy.mock.calls[0]?.[0];
    expect(typeof raw).toBe("string");

    const parsed = JSON.parse(String(raw)) as {
      level: string;
      event: string;
      requestId: string;
      metadata: { partnerOrderId: string; accessToken: string };
    };

    expect(parsed.level).toBe("info");
    expect(parsed.event).toBe("session_create_started");
    expect(parsed.requestId).toBe("req_123");
    expect(parsed.metadata.partnerOrderId).toBe("po_123");
    expect(parsed.metadata.accessToken).toBe("[REDACTED]");
  });
});
