import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { withRequestIdHeader } from "@/lib/observability/request-context";

type ErrorBody = {
  error: string;
  details?: unknown;
};

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function errorResponse(error: unknown, requestId?: string) {
  const isProd = process.env.NODE_ENV === "production";
  const headers = requestId ? withRequestIdHeader(undefined, requestId) : undefined;

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        details: isProd ? undefined : error.details
      } satisfies ErrorBody,
      { status: error.statusCode, headers }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: error.flatten()
      } satisfies ErrorBody,
      { status: 400, headers }
    );
  }

  logger.error("Unhandled API error", {
    error: error instanceof Error ? error.message : String(error)
  });

  return NextResponse.json(
    { error: "Internal server error" } satisfies ErrorBody,
    { status: 500, headers }
  );
}
