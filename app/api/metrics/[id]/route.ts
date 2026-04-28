import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emptyDashboardData, mapRowsToDashboardData } from "@/lib/metricsData";
import { errorResponse, requestIdFrom, withDbRetry, JSON_HEADERS } from "@/lib/api";

const METRIC_IDS = [
  "revenue",
  "customers",
  "conversionRate",
  "churnRate",
  "avgOrderValue",
] as const;

export type MetricSeriesId = (typeof METRIC_IDS)[number];

export type MetricByIdResponse = {
  id: string;
  data: number[];
  labels: string[];
};

function isMetricId(id: string): id is MetricSeriesId {
  return (METRIC_IDS as readonly string[]).includes(id);
}

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/metrics/[id]
 *
 * `id` must be one of: revenue, customers, conversionRate, churnRate, avgOrderValue
 */
export async function GET(_request: Request, context: RouteParams): Promise<NextResponse> {
  const requestId = requestIdFrom(_request);
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
      return errorResponse(requestId, "INTERNAL_ERROR", "Unable to validate user session", 500);
    }
    if (!user) {
      return errorResponse(requestId, "UNAUTHORIZED", "Unauthorized", 401);
    }

    const { id } = await context.params;

    if (!isMetricId(id)) {
      return errorResponse(requestId, "NOT_FOUND", "Not Found", 404);
    }

    const { data: rows, error: rowsError } = await withDbRetry(async () =>
      await supabase
        .from("daily_metrics")
        .select(
          "id,user_id,date,revenue,customers,conversion_rate,churn_rate,avg_order_value,created_at,updated_at",
        )
        .eq("user_id", user.id)
        .order("date", { ascending: true }),
    );

    if (rowsError) {
      return errorResponse(requestId, "DB_ERROR", "Failed to load metrics", 500);
    }

    const data = rows && rows.length > 0 ? mapRowsToDashboardData(rows) : emptyDashboardData();
    const payload: MetricByIdResponse = {
      id,
      data: [...data[id]],
      labels: [...data.labels],
    };

    const response = NextResponse.json(payload, { status: 200, headers: JSON_HEADERS });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch {
    return errorResponse(requestId, "INTERNAL_ERROR", "Internal Server Error", 500);
  }
}
