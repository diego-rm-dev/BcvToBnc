import { describe, expect, it } from "vitest";
import { mapTransakStatus } from "@/lib/providers/transak";

describe("mapTransakStatus", () => {
  it("mapea estados conocidos", () => {
    expect(mapTransakStatus({ status: "created" })).toBe("PENDING");
    expect(mapTransakStatus({ status: "awaiting_payment" })).toBe("WAITING_PAYMENT");
    expect(mapTransakStatus({ status: "awaiting_payment_from_user" })).toBe("WAITING_PAYMENT");
    expect(mapTransakStatus({ status: "in_progress" })).toBe("PROCESSING");
    expect(mapTransakStatus({ status: "payment_done_marked_by_user" })).toBe("PROCESSING");
    expect(mapTransakStatus({ status: "success" })).toBe("COMPLETED");
    expect(mapTransakStatus({ status: "failed" })).toBe("FAILED");
    expect(mapTransakStatus({ status: "refunded" })).toBe("FAILED");
    expect(mapTransakStatus({ status: "expired" })).toBe("EXPIRED");
  });

  it("usa fallback para estado desconocido", () => {
    expect(mapTransakStatus({ status: "otro_estado" })).toBe("PROCESSING");
  });
});
