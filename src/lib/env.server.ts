function read(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function envRequired(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function envOptional(name: string): string | undefined {
  return read(name);
}

export function envNumber(name: string, fallback: number): number {
  const value = read(name);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function envList(name: string, fallback: string[] = []): string[] {
  const value = read(name);
  if (!value) return fallback;
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
