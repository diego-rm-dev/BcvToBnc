export const INTERNAL_NETWORKS = ["polygon", "bsc"] as const;

export type InternalNetwork = (typeof INTERNAL_NETWORKS)[number];

export function isSupportedInternalNetwork(value: unknown): value is InternalNetwork {
  return value === "polygon" || value === "bsc";
}

export function normalizeInternalNetwork(
  value: string | null | undefined,
  fallback: InternalNetwork = "polygon"
): InternalNetwork {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();

  if (normalized === "polygon") return "polygon";
  if (normalized === "bsc" || normalized === "bnb" || normalized === "bnb chain") return "bsc";

  if (normalized === "matic" || normalized === "polygon mainnet") return "polygon";
  if (normalized === "binance smart chain" || normalized === "bnb smart chain") return "bsc";

  return fallback;
}

export function mapInternalNetworkToTransak(network: InternalNetwork): InternalNetwork {
  if (network === "polygon") return "polygon";
  return "bsc";
}

export function mapInternalNetworkToDisplayLabel(network: InternalNetwork): string {
  if (network === "polygon") return "Polygon";
  return "BNB Chain";
}

export function mapInternalNetworkToBinanceReferenceLabel(network: InternalNetwork): string {
  if (network === "polygon") return "Polygon (MATIC)";
  return "BNB Smart Chain (BEP20)";
}
