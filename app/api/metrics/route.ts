import { NextResponse } from "next/server";
import { dashboardData, sliceDashboardData } from "@/lib/data";
import type { DashboardData } from "@/lib/data";
import { evaluateBusiness } from "@/lib/ruleEngine";
import type { BusinessResult } from "@/lib/ruleEngine";
import type { Rule } from "@/lib/ruleEngine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emptyDashboardData, mapRowsToDashboardData } from "@/lib/metricsData";
import { cleanDashboardData } from "@/lib/preprocessMetrics";
import {
  emitMonitoringEvent,
  errorResponse,
  logServer,
  requestIdFrom,
  withDbRetry,
  JSON_HEADERS,
} from "@/lib/api";

const ALLOWED_DAYS = new Set([7, 14, 30]);

const RULE_CATEGORIES: readonly Rule["category"][] = [
  "revenue",
  "growth",
  "retention",
  "efficiency",
] as const;

function isRuleCategory(value: string): value is Rule["category"] {
  return (RULE_CATEGORIES as readonly string[]).includes(value);
}

export type MetricsGETResponse = {
  metrics: DashboardData;
  analysis: BusinessResult[];
  summary: {
    totalIssues: number;
    criticalCount: number;
    lastUpdated: string;
  };
  sourceState: {
    source: "real" | "sample";
    preference: "supabase" | "csv" | "sample" | null;
    needsOnboarding: boolean;
    rowCount: number;
  };
};

function parseDays(searchParams: URLSearchParams): number | NextResponse {
  const raw = searchParams.get("days");
  if (raw === null || raw === "") return 30;
  const n = Number(raw);
  if (!Number.isInteger(n) || !ALLOWED_DAYS.has(n)) {
    return NextResponse.json(
      { error: "Invalid days parameter" },
      { status: 400, headers: JSON_HEADERS },
    );
  }
  return n;
}

function parseCategory(
  searchParams: URLSearchParams,
): Rule["category"] | undefined | NextResponse {
  const raw = searchParams.get("category");
  if (raw === null || raw === "") return undefined;
  if (!isRuleCategory(raw)) {
    return NextResponse.json(
      { error: "Invalid category parameter" },
      { status: 400, headers: JSON_HEADERS },
    );
  }
  return raw;
}

/**
 * GET /api/metrics
 *
 * Query:
 * - days: 7 | 14 | 30 (default 30)
 * - category: revenue | growth | retention | efficiency (optional — filters analysis only)
 */
export async function GET(request: Request): Promise<NextResponse> {
  const requestId = requestIdFrom(request);
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

    const url = new URL(request.url);
    const daysResult = parseDays(url.searchParams);
    if (daysResult instanceof NextResponse) return daysResult;

    const categoryResult = parseCategory(url.searchParams);
    if (categoryResult instanceof NextResponse) return categoryResult;

    const [{ data: rows, error: rowsError }, { data: profile }] = await Promise.all([
      withDbRetry(async () =>
        await supabase
          .from("daily_metrics")
          .select(
            "id,user_id,date,revenue,customers,conversion_rate,churn_rate,avg_order_value,created_at,updated_at",
          )
          .eq("user_id", user.id)
          .order("date", { ascending: true }),
      ),
      supabase
        .from("profiles")
        .select("data_source_preference")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (rowsError) {
      logServer("error", "metrics_query_failed", { requestId, userId: user.id, details: rowsError.message });
      return errorResponse(requestId, "DB_ERROR", "Failed to load metrics", 500);
    }

    const preference = profile?.data_source_preference ?? null;
    const hasRows = Boolean(rows && rows.length > 0);
    const baseData = hasRows
      ? mapRowsToDashboardData(rows!)
      : preference === "sample"
        ? dashboardData
        : emptyDashboardData();

    const source: "real" | "sample" = hasRows ? "real" : preference === "sample" ? "sample" : "real";
    const needsOnboarding = !hasRows && preference === null;

    const cleanedData = cleanDashboardData(baseData);
    const sliced = sliceDashboardData(cleanedData, daysResult);
    let analysis = evaluateBusiness(sliced);

    if (categoryResult !== undefined) {
      analysis = analysis.filter((r) => r.category === categoryResult);
    }

    const criticalCount = analysis.filter((r) => r.severity === "critical").length;

    const payload: MetricsGETResponse = {
      metrics: sliced,
      analysis,
      summary: {
        totalIssues: analysis.length,
        criticalCount,
        lastUpdated: new Date().toISOString(),
      },
      sourceState: {
        source,
        preference,
        needsOnboarding,
        rowCount: rows?.length ?? 0,
      },
    };

    if ((rows?.length ?? 0) === 0) {
      await emitMonitoringEvent("empty_dashboard_data", {
        requestId,
        userId: user.id,
        preference,
      });
    }

    const response = NextResponse.json(payload, { status: 200, headers: JSON_HEADERS });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch {
    logServer("error", "metrics_internal_error", { requestId });
    return errorResponse(requestId, "INTERNAL_ERROR", "Internal Server Error", 500);
  }
}
