import { OrderStatus } from "@prisma/client";
import { mapInternalStatusToOrderStatus } from "@/lib/orders/mappers";
import { mapTransakStatus } from "@/lib/providers/transak";

export type TransakOrderWebhookEnvelope = {
  eventId: string | null;
  dataJwt: string | null;
  rawEnvelope: Record<string, unknown>;
};

export type ParsedTransakWebhook = {
  envelope: TransakOrderWebhookEnvelope;
  decodedPayload: Record<string, unknown>;
  partnerOrderId: string | null;
  externalStatus: string | null;
  providerReference: string | null;
};

export function parseJsonObject(rawBody: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseTransakOrderWebhookEnvelope(
  payload: Record<string, unknown>
): TransakOrderWebhookEnvelope {
  return {
    eventId: pickString(payload.eventID, payload.eventId, payload.event),
    dataJwt: pickString(payload.data),
    rawEnvelope: payload
  };
}

export function extractTransakWebhookData(
  envelope: TransakOrderWebhookEnvelope,
  decodedPayload: Record<string, unknown>
): ParsedTransakWebhook {
  const webhookData = asRecord(decodedPayload.webhookData) ?? asRecord(decodedPayload.data);

  const partnerOrderId = pickString(
    decodedPayload.partnerOrderId,
    decodedPayload.partner_order_id,
    webhookData?.partnerOrderId,
    webhookData?.partner_order_id,
    webhookData?.merchantOrderId,
    webhookData?.merchant_order_id
  );

  const externalStatus = pickString(
    decodedPayload.status,
    decodedPayload.orderStatus,
    webhookData?.status
  );

  const providerReference = pickString(
    webhookData?.id,
    webhookData?.orderId,
    decodedPayload.orderId,
    decodedPayload.id
  );

  return {
    envelope,
    decodedPayload,
    partnerOrderId,
    externalStatus,
    providerReference
  };
}

export function mapExternalStatusToOrderStatus(externalStatus: string | null): OrderStatus {
  const internalStatus = mapTransakStatus({ status: externalStatus });
  return mapInternalStatusToOrderStatus(internalStatus);
}
