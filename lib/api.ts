import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "DB_ERROR"
  | "INTERNAL_ERROR";

export type ApiErrorEnvelope = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
  };
};

export type ApiSuccessEnvelope<T> = {
  ok: true;
  data: T;
  requestId: string;
};

export function requestIdFrom(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function logServer(level: "info" | "warn" | "error", event: string, details: Record<string, unknown>): void {
  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    ...details,
  };
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

export async function emitMonitoringEvent(event: string, payload: Record<string, unknown>): Promise<void> {
  const hook = process.env.MONITORING_WEBHOOK_URL;
  if (!hook) return;
  try {
    await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        ts: new Date().toISOString(),
        ...payload,
      }),
    });
  } catch {
    // Avoid throwing in API path for monitoring failures.
  }
}

export function errorResponse(
  requestId: string,
  code: ApiErrorCode,
  message: string,
  status: number,
): NextResponse<ApiErrorEnvelope> {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message, requestId },
    },
    { status, headers: JSON_HEADERS },
  );
}

export function successResponse<T>(requestId: string, data: T, status = 200): NextResponse<ApiSuccessEnvelope<T>> {
  return NextResponse.json(
    {
      ok: true,
      data,
      requestId,
    },
    { status, headers: JSON_HEADERS },
  );
}

export function parseJsonBody<T>(raw: unknown, guard: (value: unknown) => value is T): T | null {
  if (!guard(raw)) return null;
  return raw;
}

export async function requireApiUser(requestId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    return {
      ok: false as const,
      response: errorResponse(requestId, "INTERNAL_ERROR", "Unable to validate user session", 500),
      supabase,
    };
  }
  if (!user) {
    return {
      ok: false as const,
      response: errorResponse(requestId, "UNAUTHORIZED", "Unauthorized", 401),
      supabase,
    };
  }
  return { ok: true as const, supabase, user };
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 120,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        const wait = baseDelayMs * (i + 1);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }
  throw lastError;
}

type RateWindow = { timestamps: number[] };
const rateMap = new Map<string, RateWindow>();

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function isRateLimited(key: string, maxReq: number, windowMs: number): boolean {
  const now = Date.now();
  const prev = rateMap.get(key)?.timestamps ?? [];
  const recent = prev.filter((ts) => now - ts < windowMs);
  if (recent.length >= maxReq) {
    rateMap.set(key, { timestamps: recent });
    return true;
  }
  recent.push(now);
  rateMap.set(key, { timestamps: recent });
  return false;
}
