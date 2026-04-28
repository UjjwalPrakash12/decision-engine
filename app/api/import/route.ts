import { NextResponse } from "next/server";
import { parseMetricsCsv } from "@/lib/csvMetrics";
import {
  emitMonitoringEvent,
  errorResponse,
  getClientIp,
  isRateLimited,
  logServer,
  parseJsonBody,
  requestIdFrom,
  requireApiUser,
  withDbRetry,
  JSON_HEADERS,
} from "@/lib/api";

export type ImportBody = {
  csv: string;
  fileName?: string;
};

type ImportResponse = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

function isImportBody(v: unknown): v is ImportBody {
  if (!v || typeof v !== "object") return false;
  const body = v as Partial<ImportBody>;
  return typeof body.csv === "string" && (body.fileName === undefined || typeof body.fileName === "string");
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = requestIdFrom(request);
  const ip = getClientIp(request);
  if (isRateLimited(`import:${ip}`, 10, 60_000)) {
    return errorResponse(requestId, "RATE_LIMITED", "Rate limit exceeded. Try again in a minute.", 429);
  }

  try {
    const auth = await requireApiUser(requestId);
    if (!auth.ok) return auth.response;
    const { supabase, user } = auth;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse(requestId, "BAD_REQUEST", "Invalid JSON body", 400);
    }

    const body = parseJsonBody<ImportBody>(rawBody, isImportBody);
    if (!body) {
      return errorResponse(requestId, "BAD_REQUEST", "Missing csv payload", 400);
    }

    const parsed = parseMetricsCsv(body.csv);

    if (parsed.totalRows > 365) {
      return errorResponse(
        requestId,
        "BAD_REQUEST",
        `CSV has ${parsed.totalRows} rows. Maximum allowed is 365.`,
        400,
      );
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        {
          inserted: 0,
          updated: 0,
          skipped: parsed.totalRows,
          errors: parsed.errors,
        },
        { status: 200, headers: JSON_HEADERS },
      );
    }

    const incomingDates = parsed.rows.map((r) => r.date);
    const { data: existingRows, error: existingErr } = await withDbRetry(async () =>
      await supabase
        .from("daily_metrics")
        .select("date")
        .eq("user_id", user.id)
        .in("date", incomingDates),
    );

    if (existingErr) {
      logServer("error", "import_existing_rows_failed", { requestId, userId: user.id, details: existingErr.message });
      return errorResponse(requestId, "DB_ERROR", "Failed to check existing rows", 500);
    }

    const existingDates = new Set((existingRows ?? []).map((r: { date: string }) => r.date));
    const inserted = parsed.rows.filter((r) => !existingDates.has(r.date)).length;
    const updated = parsed.rows.length - inserted;

    const upsertPayload = parsed.rows.map((r) => ({
      user_id: user.id,
      date: r.date,
      revenue: r.revenue,
      customers: Math.round(r.customers),
      conversion_rate: r.conversionRate,
      churn_rate: r.churnRate,
      avg_order_value: r.avgOrderValue,
    }));

    const { error: upsertError } = await withDbRetry(async () =>
      await supabase
        .from("daily_metrics")
        .upsert(upsertPayload, {
          onConflict: "user_id,date",
          ignoreDuplicates: false,
        }),
    );

    if (upsertError) {
      await emitMonitoringEvent("import_failed", {
        requestId,
        userId: user.id,
        reason: upsertError.message,
      });
      logServer("error", "import_upsert_failed", { requestId, userId: user.id, details: upsertError.message });
      return errorResponse(requestId, "DB_ERROR", "Failed to import metrics", 500);
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? null,
        data_source_preference: "csv",
      },
      { onConflict: "id" },
    );
    if (profileError) {
      logServer("warn", "import_profile_preference_failed", {
        requestId,
        userId: user.id,
        details: profileError.message,
      });
      return errorResponse(requestId, "DB_ERROR", "Failed to update data source preference", 500);
    }

    const skipped = parsed.totalRows - parsed.rows.length;

    const response = NextResponse.json(
      {
        inserted,
        updated,
        skipped,
        errors: parsed.errors,
      },
      { status: 200, headers: JSON_HEADERS },
    );
    response.headers.set("x-request-id", requestId);
    return response;
  } catch {
    logServer("error", "import_internal_error", { requestId });
    return errorResponse(requestId, "INTERNAL_ERROR", "Internal Server Error", 500);
  }
}
