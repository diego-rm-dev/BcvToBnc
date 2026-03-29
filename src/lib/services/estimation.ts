import { getTransakPriceQuote } from "@/lib/providers/transak";
import type {
  EstimateGrossFiatForTargetNetCryptoInput,
  EstimateGrossFiatForTargetNetCryptoResult
} from "@/types/estimation";

function roundToCents(value: number) {
  return Math.round(value * 100) / 100;
}

function clampMin(value: number, min: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(value, min);
}

const ESTIMATE_DISCLAIMER =
  "Estimación basada en cotización pública de Transak. El monto final puede variar por mercado, comisiones, método de pago y timing.";

export async function estimateGrossFiatForTargetNetCrypto(
  input: EstimateGrossFiatForTargetNetCryptoInput
): Promise<EstimateGrossFiatForTargetNetCryptoResult> {
  const targetNetCryptoAmount = clampMin(input.targetNetCryptoAmount, 0);
  const baseFiatFallback = clampMin(input.initialFiatAmount ?? targetNetCryptoAmount, 1);
  const safetyBufferPct = Math.min(Math.max(input.safetyBufferPct ?? 0.03, 0), 0.2);

  if (targetNetCryptoAmount <= 0) {
    return {
      targetNetCryptoAmount,
      recommendedFiatAmount: roundToCents(baseFiatFallback),
      estimatedNetCryptoAmount: null,
      estimatedGrossCryptoAmount: null,
      estimatedTotalFeeFiat: null,
      estimatedTotalFeeCrypto: null,
      marginPct: safetyBufferPct,
      isEstimate: true,
      disclaimer: ESTIMATE_DISCLAIMER,
      quoteRequestedAt: null,
      quoteInput: null,
      quoteOutputSummary: null,
      quoteUsed: null,
      strategy: "fallback"
    };
  }

  try {
    // En modo neto objetivo pedimos quote por cryptoAmount para evitar matemática inventada.
    const quote = await getTransakPriceQuote({
      fiatCurrency: input.fiatCurrency,
      cryptoCurrency: input.cryptoCurrency,
      network: input.network,
      cryptoAmount: targetNetCryptoAmount,
      isBuyOrSell: "BUY",
      quoteCountryCode: input.quoteCountryCode,
      paymentMethod: undefined,
      walletAddress: input.walletAddress
    });

    if (quote.fiatAmount === null || quote.fiatAmount <= 0) {
      return {
        targetNetCryptoAmount,
        recommendedFiatAmount: roundToCents(baseFiatFallback),
        estimatedNetCryptoAmount: null,
        estimatedGrossCryptoAmount: quote.estimatedCryptoAmount,
        estimatedTotalFeeFiat: quote.estimatedTotalFee,
        estimatedTotalFeeCrypto: null,
        marginPct: safetyBufferPct,
        isEstimate: true,
        disclaimer: ESTIMATE_DISCLAIMER,
        quoteRequestedAt: quote.quoteTimestamp,
        quoteInput: quote.input,
        quoteOutputSummary: quote.summary,
        quoteUsed: quote,
        strategy: "fallback"
      };
    }

    const recommendedFiatAmount = roundToCents(quote.fiatAmount * (1 + safetyBufferPct));

    return {
      targetNetCryptoAmount,
      recommendedFiatAmount,
      estimatedNetCryptoAmount: quote.estimatedCryptoAmount,
      estimatedGrossCryptoAmount: quote.estimatedCryptoAmount,
      estimatedTotalFeeFiat: quote.estimatedTotalFee,
      // El endpoint de quote no entrega fee en cripto de forma explícita.
      estimatedTotalFeeCrypto: null,
      marginPct: safetyBufferPct,
      isEstimate: true,
      disclaimer: ESTIMATE_DISCLAIMER,
      quoteRequestedAt: quote.quoteTimestamp,
      quoteInput: quote.input,
      quoteOutputSummary: quote.summary,
      quoteUsed: quote,
      strategy: "quote_crypto_target"
    };
  } catch {
    // Degradación elegante: seguimos con monto fijo/base, sin bloquear creación de sesión.
    return {
      targetNetCryptoAmount,
      recommendedFiatAmount: roundToCents(baseFiatFallback),
      estimatedNetCryptoAmount: null,
      estimatedGrossCryptoAmount: null,
      estimatedTotalFeeFiat: null,
      estimatedTotalFeeCrypto: null,
      marginPct: safetyBufferPct,
      isEstimate: true,
      disclaimer: ESTIMATE_DISCLAIMER,
      quoteRequestedAt: null,
      quoteInput: null,
      quoteOutputSummary: null,
      quoteUsed: null,
      strategy: "fallback"
    };
  }
}
