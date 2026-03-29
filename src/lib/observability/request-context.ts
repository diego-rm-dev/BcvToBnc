import { randomUUID } from "crypto";
import { getClientIp } from "@/lib/security/request";

export type RequestContext = {
  requestId: string;
  method: string;
  path: string;
  clientIp: string;
};

function normalizeRequestId(value: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  if (candidate.length > 120) return null;
  return candidate;
}

export function getOrCreateRequestId(request: Request): string {
  const fromHeader = normalizeRequestId(request.headers.get("x-request-id"));
  if (fromHeader) return fromHeader;
  return randomUUID();
}

export function createRequestContext(request: Request): RequestContext {
  const url = new URL(request.url);
  return {
    requestId: getOrCreateRequestId(request),
    method: request.method,
    path: url.pathname,
    clientIp: getClientIp(request)
  };
}

export function withRequestIdHeader(headers: HeadersInit | undefined, requestId: string): HeadersInit {
  const merged = new Headers(headers);
  merged.set("x-request-id", requestId);
  return merged;
}

