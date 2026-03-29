import type { GetTransakPriceQuoteResult } from "@/types/payments";
import type { InternalNetwork } from "@/lib/networks";

export type EstimateGrossFiatForTargetNetCryptoInput = {
  targetNetCryptoAmount: number;
  fiatCurrency: string;
  cryptoCurrency: string;
  network: InternalNetwork;
  walletAddress?: string;
  initialFiatAmount?: number;
  safetyBufferPct?: number;
  quoteCountryCode?: string;
};

export type EstimateGrossFiatForTargetNetCryptoResult = {
  targetNetCryptoAmount: number;
  recommendedFiatAmount: number;
  estimatedNetCryptoAmount: number | null;
  estimatedGrossCryptoAmount: number | null;
  estimatedTotalFeeFiat: number | null;
  estimatedTotalFeeCrypto: number | null;
  marginPct: number;
  isEstimate: true;
  disclaimer: string;
  quoteRequestedAt: string | null;
  quoteInput: Record<string, unknown> | null;
  quoteOutputSummary: Record<string, unknown> | null;
  // Última cotización usada como evidencia de cálculo.
  quoteUsed: GetTransakPriceQuoteResult | null;
  // "quote_crypto_target" cuando hay quote real, "fallback" cuando el proveedor no dio data suficiente.
  strategy: "quote_crypto_target" | "fallback";
};
