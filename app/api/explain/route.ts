import { NextResponse } from "next/server";
import {
  errorResponse,
  getClientIp,
  isRateLimited,
  parseJsonBody,
  requestIdFrom,
} from "@/lib/api";

const MODEL = "gemini-2.0-flash";
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_REQ_PER_MIN = 10;
const WINDOW_MS = 60_000;

type ExplainRequestBody = {
  insight: string;
  metrics: {
    revenue: number[];
    customers: number[];
  };
  severity: string;
};

function isExplainBody(v: unknown): v is ExplainRequestBody {
  if (!v || typeof v !== "object") return false;
  const b = v as Partial<ExplainRequestBody>;
  return (
    typeof b.insight === "string" &&
    typeof b.severity === "string" &&
    Array.isArray(b.metrics?.revenue) &&
    Array.isArray(b.metrics?.customers)
  );
}

function sanitizeMetrics(values: number[]): number[] {
  return values.filter((v) => Number.isFinite(v)).slice(-30);
}

function makeUserPrompt(body: ExplainRequestBody): string {
  const rev = sanitizeMetrics(body.metrics.revenue);
  const cust = sanitizeMetrics(body.metrics.customers);
  return [
    `Insight: ${body.insight}`,
    `Severity: ${body.severity}`,
    `Revenue recent values: ${rev.join(", ")}`,
    `Customer recent values: ${cust.join(", ")}`,
    "Explain what is likely causing this and what business impact to expect.",
  ].join("\n");
}

function extractGeminiText(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const candidates = (json as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const first = candidates[0] as { content?: { parts?: Array<{ text?: string }> } };
  const parts = first.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);

  if (isRateLimited(`explain:${getClientIp(request)}`, MAX_REQ_PER_MIN, WINDOW_MS)) {
    return errorResponse(requestId, "RATE_LIMITED", "Rate limit exceeded. Try again in a minute.", 429);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return errorResponse(requestId, "INTERNAL_ERROR", "Missing GEMINI_API_KEY", 500);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse(requestId, "BAD_REQUEST", "Invalid JSON body", 400);
  }
  const body = parseJsonBody<ExplainRequestBody>(rawBody, isExplainBody);

  if (!body) {
    return errorResponse(requestId, "BAD_REQUEST", "Invalid payload", 400);
  }

  const geminiResponse = await fetch(`${GEMINI_API}/${MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are a senior business analyst. Explain the cause and impact of this insight in 3 sentences. Be direct and specific. No vague language.",
          },
        ],
      },
      contents: [{ role: "user", parts: [{ text: makeUserPrompt(body) }] }],
      generationConfig: {
        maxOutputTokens: 220,
        temperature: 0.2,
      },
    }),
  });

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    return NextResponse.json(
      { error: `Gemini request failed: ${errorText || geminiResponse.status}` },
      { status: 502 },
    );
  }
  const json = (await geminiResponse.json()) as unknown;
  const text = extractGeminiText(json);

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
