import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, requestIdFrom, withDbRetry, JSON_HEADERS } from "@/lib/api";

type SourcePreference = "supabase" | "csv" | "sample";

type RequestBody = {
  source: SourcePreference;
};

function isSourcePreference(v: unknown): v is SourcePreference {
  return v === "supabase" || v === "csv" || v === "sample";
}

export async function POST(request: Request): Promise<NextResponse> {
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

    const body = (await request.json()) as RequestBody;
    if (!isSourcePreference(body?.source)) {
      return errorResponse(requestId, "BAD_REQUEST", "Invalid source preference", 400);
    }

    const { error } = await withDbRetry(async () =>
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ?? null,
          data_source_preference: body.source,
        },
        { onConflict: "id" },
      ),
    );
    if (error) {
      return errorResponse(requestId, "DB_ERROR", "Failed to save preference", 500);
    }

    const response = NextResponse.json({ ok: true, source: body.source }, { status: 200, headers: JSON_HEADERS });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch {
    return errorResponse(requestId, "INTERNAL_ERROR", "Internal Server Error", 500);
  }
}
