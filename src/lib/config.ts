import { envList, envNumber, envOptional, envRequired } from "@/lib/env.server";

function transakEnvironment() {
  return (process.env.TRANSAK_ENVIRONMENT ?? "STAGING").toUpperCase();
}

function transakWidgetBaseUrl() {
  return transakEnvironment() === "PRODUCTION"
    ? "https://global.transak.com"
    : "https://global-stg.transak.com";
}

function transakApiBaseUrl() {
  return transakEnvironment() === "PRODUCTION"
    ? "https://api.transak.com"
    : "https://api-stg.transak.com";
}

function transakGatewayBaseUrl() {
  return transakEnvironment() === "PRODUCTION"
    ? "https://api-gateway.transak.com"
    : "https://api-gateway-stg.transak.com";
}

function defaultReferrerDomain() {
  const appBase = process.env.APP_BASE_URL ?? "http://localhost:3000";
  try {
    return new URL(appBase).host;
  } catch {
    return "localhost:3000";
  }
}

export const config = {
  app: {
    baseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
    allowedOrigins: envList("ALLOWED_ORIGINS", ["http://localhost:3000"])
  },
  onRamp: {
    defaultWalletAddress: envRequired("DEFAULT_WALLET_ADDRESS"),
    defaultNetwork: process.env.DEFAULT_NETWORK ?? "ethereum",
    defaultCryptoCurrency: process.env.DEFAULT_CRYPTO_CURRENCY ?? "USDT",
    defaultFiatCurrency: process.env.DEFAULT_FIAT_CURRENCY ?? "USD"
  },
  security: {
    sessionCreateRateLimitWindowMs: envNumber("SESSION_CREATE_RATE_LIMIT_WINDOW_MS", 60_000),
    sessionCreateRateLimitMaxRequests: envNumber("SESSION_CREATE_RATE_LIMIT_MAX_REQUESTS", 20)
  },
  transak: {
    environment: transakEnvironment(),
    apiKey: envOptional("TRANSAK_API_KEY"),
    partnerAccessToken: envOptional("TRANSAK_PARTNER_ACCESS_TOKEN"),
    // Access token usado para verificar/decodificar JWT del webhook Order.
    webhookAccessToken:
      envOptional("TRANSAK_WEBHOOK_ACCESS_TOKEN") ?? envOptional("TRANSAK_PARTNER_ACCESS_TOKEN"),
    // Requerido por Create Widget URL API dentro de widgetParams.
    referrerDomain: envOptional("TRANSAK_REFERRER_DOMAIN") ?? defaultReferrerDomain(),
    defaultPaymentMethod: envOptional("TRANSAK_DEFAULT_PAYMENT_METHOD"),
    webhookSecret: envOptional("TRANSAK_WEBHOOK_SECRET"),
    widgetBaseUrl: transakWidgetBaseUrl(),
    apiBaseUrl: transakApiBaseUrl(),
    apiGatewayBaseUrl: transakGatewayBaseUrl(),
    // Contrato oficial: POST /api/v2/auth/session
    createWidgetSessionEndpoint:
      envOptional("TRANSAK_SESSIONS_API_URL") ?? `${transakGatewayBaseUrl()}/api/v2/auth/session`,
    // Contrato público actual para cotización.
    quoteEndpoint:
      envOptional("TRANSAK_QUOTES_API_URL") ??
      `${transakApiBaseUrl()}/api/v1/pricing/public/quotes`,
    // Header y algoritmo para firma de webhook (ajustar con doc oficial cuando se confirme).
    webhookSignatureHeader: process.env.TRANSAK_WEBHOOK_SIGNATURE_HEADER ?? "x-webhook-signature",
    webhookSignatureAlgorithm: process.env.TRANSAK_WEBHOOK_SIGNATURE_ALGO ?? "sha256"
  }
};
