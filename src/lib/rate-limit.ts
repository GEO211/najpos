import { headers } from "next/headers";

export const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const authAttempts = new Map<string, RateLimitEntry>();

function pruneExpiredEntries(now: number) {
  for (const [key, entry] of authAttempts.entries()) {
    if (now >= entry.resetAt) {
      authAttempts.delete(key);
    }
  }
}

export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");

  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = headersList.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

export function checkAuthRateLimit(key: string):
  | { allowed: true }
  | { allowed: false; message: string } {
  const now = Date.now();
  pruneExpiredEntries(now);

  const entry = authAttempts.get(key);
  if (!entry || now >= entry.resetAt) {
    return { allowed: true };
  }

  if (entry.count >= AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
    const retryMinutes = Math.max(
      1,
      Math.ceil((entry.resetAt - now) / 60_000)
    );
    return {
      allowed: false,
      message: `Too many attempts. Please try again in ${retryMinutes} minute${retryMinutes === 1 ? "" : "s"}.`,
    };
  }

  return { allowed: true };
}

export function recordAuthFailure(key: string) {
  const now = Date.now();
  pruneExpiredEntries(now);

  const entry = authAttempts.get(key);
  if (!entry || now >= entry.resetAt) {
    authAttempts.set(key, {
      count: 1,
      resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  entry.count += 1;
}

export function clearAuthRateLimit(key: string) {
  authAttempts.delete(key);
}

export function buildAuthRateLimitKey(ip: string) {
  return `auth:login:${ip}`;
}
