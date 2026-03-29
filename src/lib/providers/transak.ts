import { createHmac, timingSafeEqual } from "crypto";
import jwt, { JwtPayload } from "jsonwebtoken";
import { AppError } from "@/lib/errors";
import { config } from "@/lib/config";
import { mapInternalNetworkToTransak } from "@/lib/networks";
import { buildTransakWidgetParams, TRANSAK_WIDGET_PARAM_GUIDE } from "@/lib/providers/transak-widget-params";
import type {
  CreateTransakSessionInput,
  CreateTransakSessionResult,
  GetTransakPriceQuoteInput,
  GetTransakPriceQuoteResult,
  InternalPaymentStatus,
  MapTransakStatusInput,
  VerifyTransakWebhookSignatureInput,
  VerifyTransakWebhookSignatureResult
} from "@/types/payments";

type TransakSessionHttpResponse = {
  data?: {
    widgetUrl?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type TransakQuoteHttpResponse = {
  response?: {
    quoteId?: string;
    fiatAmount?: number | string;
    cryptoAmount?: number | string;
    totalFee?: number | string;
    conversionPrice?: number | string;
    marketConversionPrice?: number | string;
    paymentMethod?: string;
    slippage?: number | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

async function transakRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const rawText = await response.text();
  const data = rawText ? (JSON.parse(rawText) as unknown) : null;

  if (!response.ok) {
    throw new AppError(502, "Transak HTTP request failed", {
      url,
      status: response.status,
      body: data
    });
  }

  return data as T;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function mapTransakStatus(input: MapTransakStatusInput): InternalPaymentStatus {
  const status = input.status?.toUpperCase() ?? "";

  if (["INITIATED", "CREATED", "PENDING"].includes(status)) return "PENDING";
  if (["AWAITING_PAYMENT", "WAITING_PAYMENT", "AWAITING_PAYMENT_FROM_USER"].includes(status)) {
    return "WAITING_PAYMENT";
  }
  if (["IN_PROGRESS", "PROCESSING"].includes(status)) return "PROCESSING";
  if (["PAYMENT_DONE_MARKED_BY_USER", "PENDING_DELIVERY_FROM_TRANSAK"].includes(status)) {
    return "PROCESSING";
  }
  if (["COMPLETED", "SUCCESS"].includes(status)) return "COMPLETED";
  if (["EXPIRED", "CANCELLED"].includes(status)) return "EXPIRED";
  if (["FAILED", "REJECTED", "REFUNDED"].includes(status)) return "FAILED";
  return "PROCESSING";
}

export function decodeTransakOrderWebhookData(token: string): Record<string, unknown> {
  const accessToken = config.transak.webhookAccessToken;
  if (!accessToken) {
    throw new AppError(500, "Missing TRANSAK_WEBHOOK_ACCESS_TOKEN");
  }

  try {
    const decoded = jwt.verify(token, accessToken);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      throw new AppError(401, "Invalid Transak webhook JWT payload");
    }

    return decoded as JwtPayload as Record<string, unknown>;
  } catch (error) {
    throw new AppError(401, "Invalid Transak webhook JWT", {
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function createTransakSession(
  input: CreateTransakSessionInput
): Promise<CreateTransakSessionResult> {
  const apiKey = config.transak.apiKey;
  const accessToken = config.transak.partnerAccessToken;

  if (!apiKey) {
    throw new AppError(500, "Missing TRANSAK_API_KEY");
  }
  if (!accessToken) {
    throw new AppError(500, "Missing TRANSAK_PARTNER_ACCESS_TOKEN");
  }

  const widgetParams = buildTransakWidgetParams({
    session: input,
    apiKey,
    referrerDomain: config.transak.referrerDomain,
    defaultPaymentMethod: config.transak.defaultPaymentMethod ?? undefined
  });

  const payload = await transakRequest<TransakSessionHttpResponse>(
    config.transak.createWidgetSessionEndpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access-token": accessToken
      },
      body: JSON.stringify({ widgetParams })
    }
  );

  const widgetUrl = payload.data?.widgetUrl;
  if (!widgetUrl) {
    throw new AppError(502, "Transak response missing widgetUrl", { payload });
  }

  return {
    provider: "TRANSAK",
    // El create widget URL solo prepara sesión; el pago aún no inicia.
    status: "WAITING_PAYMENT",
    redirectUrl: widgetUrl,
    widgetUrl,
    // NOTA: widgetUrl/sessionId expiran en 5 minutos y son single-use.
    raw: {
      ...payload,
      metadata: {
        endpoint: "/api/v2/auth/session",
        expiresInMinutes: 5,
        singleUse: true,
        warning: "Never reuse widgetUrl/sessionId for a new flow.",
        widgetParamProfile: TRANSAK_WIDGET_PARAM_GUIDE
      }
    }
  };
}

export async function getTransakPriceQuote(
  input: GetTransakPriceQuoteInput
): Promise<GetTransakPriceQuoteResult> {
  const apiKey = config.transak.apiKey;
  const quoteTimestamp = new Date().toISOString();
  const transakNetwork = mapInternalNetworkToTransak(input.network);
  const normalizedInput = {
    fiatCurrency: input.fiatCurrency,
    cryptoCurrency: input.cryptoCurrency,
    network: transakNetwork,
    isBuyOrSell: input.isBuyOrSell ?? "BUY",
    fiatAmount: input.fiatAmount ?? null,
    cryptoAmount: input.cryptoAmount ?? null,
    paymentMethod: input.paymentMethod ?? null,
    quoteCountryCode: input.quoteCountryCode ?? null
  } as const;

  // Degradación explícita cuando no hay API key.
  if (!apiKey) {
    return {
      provider: "TRANSAK",
      quoteTimestamp,
      quoteId: null,
      fiatAmount: normalizedInput.fiatAmount,
      fiatCurrency: input.fiatCurrency,
      cryptoCurrency: input.cryptoCurrency,
      network: input.network,
      estimatedCryptoAmount: null,
      estimatedTotalFee: null,
      input: normalizedInput,
      summary: {
        quoteId: null,
        fiatAmount: normalizedInput.fiatAmount,
        cryptoAmount: normalizedInput.cryptoAmount,
        totalFee: null,
        conversionPrice: null,
        marketConversionPrice: null,
        paymentMethod: normalizedInput.paymentMethod,
        slippage: null
      },
      raw: { mode: "quote_skipped_missing_api_key" }
    };
  }

  if (normalizedInput.fiatAmount === null && normalizedInput.cryptoAmount === null) {
    return {
      provider: "TRANSAK",
      quoteTimestamp,
      quoteId: null,
      fiatAmount: null,
      fiatCurrency: input.fiatCurrency,
      cryptoCurrency: input.cryptoCurrency,
      network: input.network,
      estimatedCryptoAmount: null,
      estimatedTotalFee: null,
      input: normalizedInput,
      summary: {
        quoteId: null,
        fiatAmount: null,
        cryptoAmount: null,
        totalFee: null,
        conversionPrice: null,
        marketConversionPrice: null,
        paymentMethod: normalizedInput.paymentMethod,
        slippage: null
      },
      raw: { mode: "quote_skipped_missing_amount" }
    };
  }

  const query = new URLSearchParams({
    partnerApiKey: apiKey,
    fiatCurrency: normalizedInput.fiatCurrency,
    cryptoCurrency: normalizedInput.cryptoCurrency,
    network: normalizedInput.network,
    isBuyOrSell: normalizedInput.isBuyOrSell
  });
  // TODO(transak): validar con soporte si algún entorno requiere network alias distinto (ej. "binance-smart-chain").

  if (normalizedInput.fiatAmount !== null) query.set("fiatAmount", String(normalizedInput.fiatAmount));
  if (normalizedInput.cryptoAmount !== null) {
    query.set("cryptoAmount", String(normalizedInput.cryptoAmount));
  }
  if (normalizedInput.paymentMethod) query.set("paymentMethod", normalizedInput.paymentMethod);
  if (normalizedInput.quoteCountryCode) {
    query.set("quoteCountryCode", normalizedInput.quoteCountryCode);
  }

  const payload = await transakRequest<TransakQuoteHttpResponse>(
    `${config.transak.quoteEndpoint}?${query.toString()}`,
    {
      method: "GET"
    }
  );

  const quoteResponse = payload.response ?? {};
  const quoteId =
    typeof quoteResponse.quoteId === "string" && quoteResponse.quoteId.length > 0
      ? quoteResponse.quoteId
      : null;
  const quotedFiatAmount = toNumber(quoteResponse.fiatAmount);
  const quotedCryptoAmount = toNumber(quoteResponse.cryptoAmount);
  const quotedTotalFee = toNumber(quoteResponse.totalFee);
  const conversionPrice = toNumber(quoteResponse.conversionPrice);
  const marketConversionPrice = toNumber(quoteResponse.marketConversionPrice);
  const paymentMethod =
    typeof quoteResponse.paymentMethod === "string" ? quoteResponse.paymentMethod : null;
  const slippage = toNumber(quoteResponse.slippage);

  return {
    provider: "TRANSAK",
    quoteTimestamp,
    quoteId,
    fiatAmount: quotedFiatAmount,
    fiatCurrency: input.fiatCurrency,
    cryptoCurrency: input.cryptoCurrency,
    network: input.network,
    estimatedCryptoAmount: quotedCryptoAmount,
    estimatedTotalFee: quotedTotalFee,
    input: normalizedInput,
    summary: {
      quoteId,
      fiatAmount: quotedFiatAmount,
      cryptoAmount: quotedCryptoAmount,
      totalFee: quotedTotalFee,
      conversionPrice,
      marketConversionPrice,
      paymentMethod,
      slippage
    },
    raw: payload
  };
}

export function verifyTransakWebhookSignature(
  input: VerifyTransakWebhookSignatureInput
): VerifyTransakWebhookSignatureResult {
  if (!config.transak.webhookSecret) {
    return { isValid: false, reason: "missing_webhook_secret" };
  }

  if (!input.signatureHeader) {
    return { isValid: false, reason: "missing_signature_header" };
  }

  // Placeholder robusto: HMAC del payload con secreto y comparación segura en tiempo constante.
  // Ajusta formato exacto del header según especificación oficial de Transak.
  const digest = createHmac(config.transak.webhookSignatureAlgorithm, config.transak.webhookSecret)
    .update(input.payload)
    .digest("hex");

  const expected = Buffer.from(digest);
  const received = Buffer.from(input.signatureHeader.trim());

  if (expected.length !== received.length) {
    return { isValid: false, reason: "signature_length_mismatch" };
  }

  return { isValid: timingSafeEqual(expected, received) };
}
