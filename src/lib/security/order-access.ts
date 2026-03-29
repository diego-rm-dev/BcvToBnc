import { randomBytes, timingSafeEqual } from "crypto";

export function generateStatusAccessToken(): string {
  // 32 bytes aleatorios -> 64 hex chars.
  return randomBytes(32).toString("hex");
}

export function safeTokenEquals(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
