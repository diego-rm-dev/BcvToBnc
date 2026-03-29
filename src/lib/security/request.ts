import { AppError } from "@/lib/errors";
import { config } from "@/lib/config";

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

export function assertAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Requests server-to-server normalmente no incluyen origin.
  if (!origin) return;

  const normalizedOrigin = normalizeOrigin(origin);
  const allowed = getAllowedOrigins();
  if (!normalizedOrigin || !allowed.has(normalizedOrigin)) {
    throw new AppError(403, "Origin not allowed");
  }
}

export function corsHeaders(origin?: string | null): HeadersInit {
  const allowed = getAllowedOrigins();
  const normalizedOrigin = normalizeOrigin(origin);
  const resolvedOrigin =
    normalizedOrigin && allowed.has(normalizedOrigin)
      ? normalizedOrigin
      : normalizeOrigin(config.app.baseUrl) ?? config.app.baseUrl;

  return {
    "Access-Control-Allow-Origin": resolvedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-request-id",
    "Access-Control-Expose-Headers": "x-request-id"
  };
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

function getAllowedOrigins(): Set<string> {
  const normalized = [config.app.baseUrl, ...config.app.allowedOrigins]
    .map((item) => normalizeOrigin(item))
    .filter((item): item is string => Boolean(item));

  return new Set(normalized);
}
