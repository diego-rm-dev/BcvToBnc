import { NextResponse } from "next/server";
import { OnRampProvider, OrderStatus } from "@prisma/client";
import { config } from "@/lib/config";
import { errorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createRequestContext, withRequestIdHeader } from "@/lib/observability/request-context";
import { normalizeInternalNetwork } from "@/lib/networks";
import {
  mapInternalNetworkToPrismaNetwork,
  mapInternalStatusToOrderStatus,
  resolveCryptoCurrency,
  resolveFiatCurrency
} from "@/lib/orders/mappers";
import { prisma } from "@/lib/prisma";
import { createTransakSession } from "@/lib/providers/transak";
import { generateStatusAccessToken } from "@/lib/security/order-access";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { assertAllowedOrigin, corsHeaders, getClientIp } from "@/lib/security/request";
import { estimateGrossFiatForTargetNetCrypto } from "@/lib/services/estimation";
import { createSessionSchema } from "@/lib/validation/create-session";

function generatePartnerOrderId() {
  return `paula_${Date.now()}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export async function POST(request: Request) {
  const ctx = createRequestContext(request);

  try {
    assertAllowedOrigin(request);

    const clientIp = getClientIp(request);
    const rateLimit = applyRateLimit({
      key: `session_create:${clientIp}`,
      maxRequests: config.security.sessionCreateRateLimitMaxRequests,
      windowMs: config.security.sessionCreateRateLimitWindowMs
    });

    logger.event("info", "session_create_started", {
      requestId: ctx.requestId,
      metadata: {
        path: ctx.path,
        method: ctx.method,
        clientIp: ctx.clientIp
      }
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: withRequestIdHeader({
            "Retry-After": String(Math.max(Math.ceil((rateLimit.resetAt - Date.now()) / 1000), 1)),
            ...corsHeaders(request.headers.get("origin"))
          }, ctx.requestId)
        }
      );
    }

    const rawBody = await request.json().catch(() => ({}));
    const input = createSessionSchema.parse(rawBody);

    const partnerOrderId = generatePartnerOrderId();
    const statusAccessToken = generateStatusAccessToken();
    const walletAddress = input.walletAddress ?? config.onRamp.defaultWalletAddress;
    const email = input.email ?? null;
    const internalNetwork = input.network ?? normalizeInternalNetwork(config.onRamp.defaultNetwork);
    const network = mapInternalNetworkToPrismaNetwork(internalNetwork);
    const cryptoCurrency = resolveCryptoCurrency(config.onRamp.defaultCryptoCurrency);
    const fiatCurrency = resolveFiatCurrency(config.onRamp.defaultFiatCurrency);
    const explicitFiatAmount = input.fiatAmount ?? 30;

    // Si llega objetivo neto en cripto, estimamos el fiat bruto requerido con cotización del proveedor.
    const estimation = input.targetNetCryptoAmount
      ? await estimateGrossFiatForTargetNetCrypto({
          targetNetCryptoAmount: input.targetNetCryptoAmount,
          fiatCurrency,
          cryptoCurrency,
          network: internalNetwork,
          walletAddress,
          initialFiatAmount: explicitFiatAmount
        })
      : null;

    const fiatAmount = estimation?.recommendedFiatAmount ?? explicitFiatAmount;

    const order = await prisma.order.create({
      data: {
        provider: OnRampProvider.TRANSAK,
        partnerOrderId,
        statusAccessToken,
        status: OrderStatus.PENDING,
        customerEmail: email,
        walletAddress,
        network,
        cryptoCurrency,
        fiatCurrency,
        fiatAmount,
        quotedCryptoAmount: estimation?.estimatedGrossCryptoAmount,
        quotedTotalFee: estimation?.estimatedTotalFeeFiat,
        quoteRequestedAt: estimation?.quoteRequestedAt ? new Date(estimation.quoteRequestedAt) : null,
        quoteInput: estimation?.quoteInput ? JSON.stringify(estimation.quoteInput) : null,
        quoteSummary: estimation?.quoteOutputSummary ? JSON.stringify(estimation.quoteOutputSummary) : null
      }
    });

    const statusUrl = `${config.app.baseUrl}/paula/status/${order.id}?token=${encodeURIComponent(
      statusAccessToken
    )}`;
    const redirectURL = statusUrl;

    let providerSession;
    try {
      providerSession = await createTransakSession({
        partnerOrderId,
        walletAddress,
        email: email ?? undefined,
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
        network: internalNetwork,
        redirectURL,
        defaultPaymentMethod: config.transak.defaultPaymentMethod
      });
    } catch (providerError) {
      logger.event("error", "transak_session_failed", {
        requestId: ctx.requestId,
        metadata: {
          orderId: order.id,
          partnerOrderId,
          error: providerError instanceof Error ? providerError.message : String(providerError)
        }
      });
      throw providerError;
    }

    logger.event("info", "transak_session_created", {
      requestId: ctx.requestId,
      metadata: {
        orderId: order.id,
        partnerOrderId,
        provider: "TRANSAK",
        hasWidgetUrl: Boolean(providerSession.widgetUrl)
      }
    });

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: mapInternalStatusToOrderStatus(providerSession.status),
        redirectUrl: providerSession.redirectUrl,
        rawSessionPayload: JSON.stringify({
          providerSession: providerSession.raw,
          quoteContext: estimation
            ? {
                targetNetCryptoAmount: estimation.targetNetCryptoAmount,
                recommendedFiatAmount: estimation.recommendedFiatAmount,
                estimatedNetCryptoAmount: estimation.estimatedNetCryptoAmount,
                estimatedGrossCryptoAmount: estimation.estimatedGrossCryptoAmount,
                estimatedTotalFeeFiat: estimation.estimatedTotalFeeFiat,
                estimatedTotalFeeCrypto: estimation.estimatedTotalFeeCrypto,
                marginPct: estimation.marginPct,
                isEstimate: estimation.isEstimate,
                disclaimer: estimation.disclaimer,
                quoteRequestedAt: estimation.quoteRequestedAt,
                quoteInput: estimation.quoteInput,
                quoteOutputSummary: estimation.quoteOutputSummary,
                strategy: estimation.strategy,
                quoteUsed: estimation.quoteUsed
              }
            : null
        })
      }
    });

    if (order.status !== updatedOrder.status) {
      logger.event("info", "order_status_changed", {
        requestId: ctx.requestId,
        metadata: {
          orderId: updatedOrder.id,
          fromStatus: order.status,
          toStatus: updatedOrder.status,
          source: "session_create"
        }
      });
    }

    logger.event("info", "session_create_succeeded", {
      requestId: ctx.requestId,
      metadata: {
        orderId: updatedOrder.id,
        partnerOrderId: updatedOrder.partnerOrderId,
        status: updatedOrder.status
      }
    });

    return NextResponse.json({
      orderId: updatedOrder.id,
      partnerOrderId: updatedOrder.partnerOrderId,
      provider: updatedOrder.provider,
      redirectUrl: updatedOrder.redirectUrl,
      widgetUrl: providerSession.widgetUrl,
      statusAccessToken,
      statusUrl,
      status: updatedOrder.status,
      estimate: estimation
        ? {
            targetNetCryptoAmount: estimation.targetNetCryptoAmount,
            estimatedFiatAmount: estimation.recommendedFiatAmount,
            marginPct: estimation.marginPct,
            isEstimate: estimation.isEstimate,
            disclaimer: estimation.disclaimer,
            strategy: estimation.strategy
          }
        : null
    }, {
      headers: withRequestIdHeader(corsHeaders(request.headers.get("origin")), ctx.requestId)
    });
  } catch (error) {
    logger.event("error", "session_create_failed", {
      requestId: ctx.requestId,
      metadata: {
        path: ctx.path,
        method: ctx.method,
        error: error instanceof Error ? error.message : String(error)
      }
    });

    logger.warn("Session create failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return errorResponse(error, ctx.requestId);
  }
}

export async function OPTIONS(request: Request) {
  const ctx = createRequestContext(request);
  return new NextResponse(null, {
    status: 204,
    headers: withRequestIdHeader(corsHeaders(request.headers.get("origin")), ctx.requestId)
  });
}
