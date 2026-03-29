import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createRequestContext, withRequestIdHeader } from "@/lib/observability/request-context";
import { prisma } from "@/lib/prisma";
import { safeTokenEquals } from "@/lib/security/order-access";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const ctx = createRequestContext(request);

  try {
    const token = new URL(request.url).searchParams.get("token")?.trim();
    if (!token) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers: withRequestIdHeader(undefined, ctx.requestId) }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        fiatAmount: true,
        fiatCurrency: true,
        cryptoCurrency: true,
        network: true,
        walletAddress: true,
        provider: true,
        createdAt: true,
        statusAccessToken: true
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers: withRequestIdHeader(undefined, ctx.requestId) }
      );
    }

    // Respuesta 404 en mismatch para no filtrar existencia de ids válidos.
    if (!order.statusAccessToken || !safeTokenEquals(order.statusAccessToken, token)) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers: withRequestIdHeader(undefined, ctx.requestId) }
      );
    }

    logger.event("info", "order_status_read", {
      requestId: ctx.requestId,
      metadata: {
        orderId: order.id,
        status: order.status,
        provider: order.provider
      }
    });

    return NextResponse.json({
      id: order.id,
      status: order.status,
      fiatAmount: order.fiatAmount,
      fiatCurrency: order.fiatCurrency,
      cryptoCurrency: order.cryptoCurrency,
      network: order.network,
      walletAddress: order.walletAddress,
      provider: order.provider,
      createdAt: order.createdAt.toISOString()
    }, {
      headers: withRequestIdHeader(undefined, ctx.requestId)
    });
  } catch (error) {
    logger.event("error", "order_status_read", {
      requestId: ctx.requestId,
      metadata: {
        orderId: params.id,
        error: error instanceof Error ? error.message : String(error)
      }
    });

    logger.error("GET /api/orders/[id] error", {
      error: error instanceof Error ? error.message : String(error),
      orderId: params.id
    });
    return NextResponse.json(
      { error: "Could not fetch order" },
      { status: 500, headers: withRequestIdHeader(undefined, ctx.requestId) }
    );
  }
}
