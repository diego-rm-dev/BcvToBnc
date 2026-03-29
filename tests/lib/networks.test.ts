import { describe, expect, it } from "vitest";
import {
  isSupportedInternalNetwork,
  mapInternalNetworkToBinanceReferenceLabel,
  mapInternalNetworkToDisplayLabel,
  mapInternalNetworkToTransak,
  normalizeInternalNetwork
} from "@/lib/networks";

describe("networks", () => {
  it("valida redes soportadas", () => {
    expect(isSupportedInternalNetwork("polygon")).toBe(true);
    expect(isSupportedInternalNetwork("bsc")).toBe(true);
    expect(isSupportedInternalNetwork("ethereum")).toBe(false);
  });

  it("normaliza aliases comunes", () => {
    expect(normalizeInternalNetwork("POLYGON")).toBe("polygon");
    expect(normalizeInternalNetwork("bnb chain")).toBe("bsc");
    expect(normalizeInternalNetwork("binance smart chain")).toBe("bsc");
    expect(normalizeInternalNetwork("unknown")).toBe("polygon");
  });

  it("mapea red interna a labels y valor Transak", () => {
    expect(mapInternalNetworkToTransak("polygon")).toBe("polygon");
    expect(mapInternalNetworkToTransak("bsc")).toBe("bsc");
    expect(mapInternalNetworkToDisplayLabel("polygon")).toBe("Polygon");
    expect(mapInternalNetworkToDisplayLabel("bsc")).toBe("BNB Chain");
    expect(mapInternalNetworkToBinanceReferenceLabel("polygon")).toBe("Polygon (MATIC)");
    expect(mapInternalNetworkToBinanceReferenceLabel("bsc")).toBe("BNB Smart Chain (BEP20)");
  });
});
