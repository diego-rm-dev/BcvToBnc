type RateLimitState = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitState>();

export type RateLimitInput = {
  key: string;
  maxRequests: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function applyRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const current = store.get(input.key);

  if (!current || now >= current.resetAt) {
    const resetAt = now + input.windowMs;
    store.set(input.key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(input.maxRequests - 1, 0),
      resetAt
    };
  }

  current.count += 1;
  store.set(input.key, current);

  return {
    allowed: current.count <= input.maxRequests,
    remaining: Math.max(input.maxRequests - current.count, 0),
    resetAt: current.resetAt
  };
}
