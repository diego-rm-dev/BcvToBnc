import { NextResponse } from "next/server";
import { OnRampProvider } from "@prisma/client";
import { logger } from "@/lib/logger";
import { createRequestContext, withRequestIdHeader } from "@/lib/observability/request-context";
import { decodeTransakOrderWebhookData } from "@/lib/providers/transak";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError, resolveTransakWebhookEventId } from "@/lib/webhooks/transak-idempotency";
import {
  extractTransakWebhookData,
  mapExternalStatusToOrderStatus,
  parseTransakOrderWebhookEnvelope,
  parseJsonObject
} from "@/lib/webhooks/transak";

export async function POST(request: Request) {
  const ctx = createRequestContext(request);
  const strictMode = process.env.NODE_ENV === "production";

  try {
    // Se usa raw body para auditoría e idempotencia fuerte.
    const rawBody = await request.text();
    const payload = parseJsonObject(rawBody);

    logger.event("info", "webhook_received", {
      requestId: ctx.requestId,
      metadata: {
        path: ctx.path,
        method: ctx.method,
        bodySize: rawBody.length
      }
    });

    if (!payload) {
      logger.event("warn", "webhook_invalid", {
        requestId: ctx.requestId,
        metadata: { reason: "invalid_json" }
      });
      if (strictMode) {
        return NextResponse.json(
          { received: false, error: "invalid_json" },
          { status: 400, headers: withRequestIdHeader(undefined, ctx.requestId) }
        );
      }
      return NextResponse.json(
        { received: true, ignored: true, reason: "invalid_json" },
        { headers: withRequestIdHeader(undefined, ctx.requestId) }
      );
    }

    const envelope = parseTransakOrderWebhookEnvelope(payload);
    if (!envelope.dataJwt) {
      logger.event("warn", "webhook_invalid", {
        requestId: ctx.requestId,
        metadata: {
          reason: "missing_webhook_data_jwt",
          eventId: envelope.eventId
        }
      });
      if (strictMode) {
        return NextResponse.json(
          { received: false, error: "missing_webhook_data_jwt" },
          { status: 400, headers: withRequestIdHeader(undefined, ctx.requestId) }
        );
      }
      return NextResponse.json(
        { received: true, ignored: true, reason: "missing_webhook_data_jwt" },
        { headers: withRequestIdHeader(undefined, ctx.requestId) }
      );
    }

    let decodedPayload: Record<string, unknown>;
    try {
      decodedPayload = decodeTransakOrderWebhookData(envelope.dataJwt);
    } catch (error) {
      logger.event("warn", "webhook_invalid", {
        requestId: ctx.requestId,
        metadata: {
          reason: "invalid_webhook_jwt",
          eventId: envelope.eventId
        }
      });
      logger.warn("Transak webhook JWT verification failed", {
        eventId: envelope.eventId,
        reason: error instanceof Error ? error.message : String(error)
      });
      if (strictMode) {
        return NextResponse.json(
          { received: false, error: "invalid_webhook_jwt" },
          { status: 401, headers: withRequestIdHeader(undefined, ctx.requestId) }
        );
      }
      return NextResponse.json(
        { received: true, ignored: true, reason: "invalid_webhook_jwt" },
        { headers: withRequestIdHeader(undefined, ctx.requestId) }
      );
    }

    const parsed = extractTransakWebhookData(envelope, decodedPayload);
    if (!parsed.partnerOrderId && !parsed.providerReference) {
      logger.event("warn", "webhook_invalid", {
        requestId: ctx.requestId,
        metadata: { reason: "missing_partner_order_id_or_reference" }
      });
      return NextResponse.json(
        {
          received: true,
          ignored: true,
          reason: "missing_partner_order_id_or_reference"
        },
        { headers: withRequestIdHeader(undefined, ctx.requestId) }
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(parsed.partnerOrderId ? [{ partnerOrderId: parsed.partnerOrderId }] : []),
          ...(parsed.providerReference ? [{ id: parsed.providerReference }] : [])
        ]
      }
    });

    if (!order) {
      logger.event("warn", "webhook_invalid", {
        requestId: ctx.requestId,
        metadata: {
          reason: "order_not_found",
          partnerOrderId: parsed.partnerOrderId
        }
      });
      return NextResponse.json(
        { received: true, ignored: true, reason: "order_not_found" },
        { headers: withRequestIdHeader(undefined, ctx.requestId) }
      );
    }

    const resolvedEvent = resolveTransakWebhookEventId(envelope.eventId, rawBody);
    const nextStatus = mapExternalStatusToOrderStatus(parsed.externalStatus);
    const orderIsSameStateAndPayload = order.status === nextStatus && order.rawWebhookPayload === rawBody;
    const shouldChangeStatus = order.status !== nextStatus;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.processedWebhookEvent.create({
          data: {
            provider: OnRampProvider.TRANSAK,
            eventId: resolvedEvent.eventId,
            partnerOrderId: parsed.partnerOrderId,
            orderId: order.id,
            rawPayload: rawBody
          }
        });

        if (!orderIsSameStateAndPayload) {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: nextStatus,
              rawWebhookPayload: rawBody
            }
          });
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        logger.event("info", "webhook_duplicate", {
          requestId: ctx.requestId,
          metadata: {
            orderId: order.id,
            eventId: resolvedEvent.eventId,
            eventIdFallbackUsed: resolvedEvent.isFallback
          }
        });
        return NextResponse.json(
          {
            received: true,
            processed: false,
            duplicate: true,
            orderId: order.id,
            status: nextStatus,
            eventId: resolvedEvent.eventId,
            eventIdFallbackUsed: resolvedEvent.isFallback
          },
          { headers: withRequestIdHeader(undefined, ctx.requestId) }
        );
      }
      throw error;
    }

    if (shouldChangeStatus) {
      logger.event("info", "order_status_changed", {
        requestId: ctx.requestId,
        metadata: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: nextStatus,
          source: "webhook_transak",
          eventId: resolvedEvent.eventId
        }
      });
    }

    logger.event("info", "webhook_processed", {
      requestId: ctx.requestId,
      metadata: {
        orderId: order.id,
        status: nextStatus,
        eventId: resolvedEvent.eventId,
        eventIdFallbackUsed: resolvedEvent.isFallback,
        orderWasUnchanged: orderIsSameStateAndPayload
      }
    });

    return NextResponse.json(
      {
        received: true,
        processed: true,
        duplicate: false,
        orderId: order.id,
        status: nextStatus,
        eventId: resolvedEvent.eventId,
        eventIdFallbackUsed: resolvedEvent.isFallback
      },
      { headers: withRequestIdHeader(undefined, ctx.requestId) }
    );
  } catch (error) {
    logger.event("error", "webhook_invalid", {
      requestId: ctx.requestId,
      metadata: {
        reason: "webhook_processing_failed",
        error: error instanceof Error ? error.message : String(error)
      }
    });
    logger.error("POST /api/webhooks/transak error", {
      error: error instanceof Error ? error.message : String(error)
    });
    // El proveedor suele reintentar ante 5xx; mantenemos respuesta clara.
    return NextResponse.json(
      { received: false, error: "webhook_processing_failed" },
      { status: 500, headers: withRequestIdHeader(undefined, ctx.requestId) }
    );
  }
}
