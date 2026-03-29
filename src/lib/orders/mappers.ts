import { CryptoCurrency, FiatCurrency, Network, OrderStatus } from "@prisma/client";
import { InternalNetwork, normalizeInternalNetwork } from "@/lib/networks";
import type { InternalPaymentStatus } from "@/types/payments";

export type SupportedNetworkInput = InternalNetwork;

export function resolveNetworkFromConfig(defaultNetwork: string): Network {
  return mapInternalNetworkToPrismaNetwork(normalizeInternalNetwork(defaultNetwork));
}

export function resolveRequestedNetwork(
  requestedNetwork: SupportedNetworkInput | undefined,
  defaultNetwork: string
): Network {
  const resolved = requestedNetwork ?? normalizeInternalNetwork(defaultNetwork);
  return mapInternalNetworkToPrismaNetwork(resolved);
}

export function resolveDefaultNetworkForUi(defaultNetwork: string): SupportedNetworkInput {
  return normalizeInternalNetwork(defaultNetwork);
}

export function mapInternalNetworkToPrismaNetwork(network: InternalNetwork): Network {
  if (network === "polygon") return Network.POLYGON;
  return Network.BSC;
}

export function mapPrismaNetworkToInternalNetwork(network: Network): InternalNetwork {
  if (network === Network.BSC) return "bsc";
  return "polygon";
}

export function resolveCryptoCurrency(defaultCryptoCurrency: string): CryptoCurrency {
  const normalized = defaultCryptoCurrency.toUpperCase();
  if (normalized === "USDT") return CryptoCurrency.USDT;
  return CryptoCurrency.USDT;
}

export function resolveFiatCurrency(defaultFiatCurrency: string): FiatCurrency {
  const normalized = defaultFiatCurrency.toUpperCase();
  if (normalized === "EUR") return FiatCurrency.EUR;
  if (normalized === "COP") return FiatCurrency.COP;
  return FiatCurrency.USD;
}

export function mapInternalStatusToOrderStatus(status: InternalPaymentStatus): OrderStatus {
  if (status === "PENDING") return OrderStatus.PENDING;
  if (status === "WAITING_PAYMENT") return OrderStatus.WAITING_PAYMENT;
  if (status === "PROCESSING") return OrderStatus.PROCESSING;
  if (status === "COMPLETED") return OrderStatus.COMPLETED;
  if (status === "FAILED") return OrderStatus.FAILED;
  if (status === "EXPIRED") return OrderStatus.EXPIRED;
  return OrderStatus.PROCESSING;
}
