import { createHash } from "crypto";

export type ResolvedWebhookEventId = {
  eventId: string;
  isFallback: boolean;
};

export function resolveTransakWebhookEventId(
  providerEventId: string | null,
  rawBody: string
): ResolvedWebhookEventId {
  const normalized = providerEventId?.trim();
  if (normalized) {
    return { eventId: normalized, isFallback: false };
  }

  // Fallback pragmático: hash estable del payload crudo cuando eventID no viene.
  // Esto evita reprocesar el mismo body exacto sin inventar IDs aleatorios.
  const hash = createHash("sha256").update(rawBody).digest("hex");
  return { eventId: `payload_sha256_${hash}`, isFallback: true };
}

export function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string };
  return maybe.code === "P2002";
}
