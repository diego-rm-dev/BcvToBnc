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

  const allowed = new Set([config.app.baseUrl, ...config.app.allowedOrigins]);
  if (!allowed.has(origin)) {
    throw new AppError(403, "Origin not allowed");
  }
}

export function corsHeaders(origin?: string | null): HeadersInit {
  const allowed = new Set([config.app.baseUrl, ...config.app.allowedOrigins]);
  const resolvedOrigin = origin && allowed.has(origin) ? origin : config.app.baseUrl;

  return {
    "Access-Control-Allow-Origin": resolvedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-request-id",
    "Access-Control-Expose-Headers": "x-request-id"
  };
}
