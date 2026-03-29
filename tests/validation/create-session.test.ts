import { describe, expect, it } from "vitest";
import { createSessionSchema } from "@/lib/validation/create-session";

describe("createSessionSchema", () => {
  it("acepta payload mínimo válido", () => {
    const parsed = createSessionSchema.parse({
      walletAddress: "0x1111111111111111111111111111111111111111",
      email: "paula@example.com",
      fiatAmount: 30,
      network: "polygon"
    });

    expect(parsed.walletAddress).toBe("0x1111111111111111111111111111111111111111");
    expect(parsed.network).toBe("polygon");
  });

  it("rechaza wallet inválida", () => {
    const result = createSessionSchema.safeParse({
      walletAddress: "wallet-invalida",
      email: "paula@example.com"
    });

    expect(result.success).toBe(false);
  });

  it("rechaza email inválido", () => {
    const result = createSessionSchema.safeParse({
      walletAddress: "0x1111111111111111111111111111111111111111",
      email: "correo-invalido"
    });

    expect(result.success).toBe(false);
  });

  it("rechaza network no soportada", () => {
    const result = createSessionSchema.safeParse({
      walletAddress: "0x1111111111111111111111111111111111111111",
      network: "ethereum"
    });

    expect(result.success).toBe(false);
  });
});
