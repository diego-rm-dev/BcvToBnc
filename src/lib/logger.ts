import type { AppLogEvent } from "@/lib/observability/events";

type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;
type LogLine = {
  timestamp: string;
  level: LogLevel;
  event?: string;
  message?: string;
  requestId?: string;
  metadata?: LogContext;
};

const SENSITIVE_KEY_PARTS = [
  "secret",
  "apikey",
  "api_key",
  "token",
  "authorization",
  "password",
  "cookie"
];

function hasSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function sanitizeString(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("bearer ")) return "[REDACTED]";
  if (value.length > 140) return `${value.slice(0, 137)}...`;
  return value;
}

export function sanitizeLogValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeLogValue);
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      if (hasSensitiveKey(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = sanitizeLogValue(v);
      }
    }
    return out;
  }

  return value;
}

function write(level: LogLevel, line: LogLine) {
  const serialized = JSON.stringify(line);

  if (level === "info") console.info(serialized);
  if (level === "warn") console.warn(serialized);
  if (level === "error") console.error(serialized);
}

export const logger = {
  event(
    level: LogLevel,
    event: AppLogEvent | (string & {}),
    options?: { requestId?: string; metadata?: LogContext }
  ) {
    const metadata = options?.metadata
      ? (sanitizeLogValue(options.metadata) as LogContext)
      : undefined;

    write(level, {
      timestamp: new Date().toISOString(),
      level,
      event,
      requestId: options?.requestId,
      metadata
    });
  },
  info(message: string, context?: LogContext) {
    const metadata = context ? (sanitizeLogValue(context) as LogContext) : undefined;
    write("info", {
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      metadata
    });
  },
  warn(message: string, context?: LogContext) {
    const metadata = context ? (sanitizeLogValue(context) as LogContext) : undefined;
    write("warn", {
      timestamp: new Date().toISOString(),
      level: "warn",
      message,
      metadata
    });
  },
  error(message: string, context?: LogContext) {
    const metadata = context ? (sanitizeLogValue(context) as LogContext) : undefined;
    write("error", {
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      metadata
    });
  }
};
