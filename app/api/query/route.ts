import { NextResponse } from "next/server";
import { dashboardData, sliceDashboardData } from "@/lib/data";
import { evaluateBusiness } from "@/lib/ruleEngine";
import { cleanDashboardData } from "@/lib/preprocessMetrics";
import { errorResponse, parseJsonBody, requestIdFrom } from "@/lib/api";

const MODEL = "gemini-2.0-flash";
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

type QueryBody = {
  question: string;
  timeRange?: number;
};

function isQueryBody(v: unknown): v is QueryBody {
  if (!v || typeof v !== "object") return false;
  const b = v as Partial<QueryBody>;
  return typeof b.question === "string" && (b.timeRange === undefined || Number.isFinite(b.timeRange));
}

function summarize(timeRange: number): string {
  const sliced = sliceDashboardData(cleanDashboardData(dashboardData), timeRange);
  const analysis = evaluateBusiness(sliced);
  const latest = sliced.revenue.length - 1;
  return JSON.stringify({
    timeRange,
    latest: {
      revenue: sliced.revenue[latest] ?? 0,
      customers: sliced.customers[latest] ?? 0,
      conversionRate: sliced.conversionRate[latest] ?? 0,
      churnRate: sliced.churnRate[latest] ?? 0,
    },
    trends: {
      revenue: sliced.revenue.slice(-7),
      customers: sliced.customers.slice(-7),
    },
    alerts: analysis.slice(0, 6),
  });
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
  const body = parseJsonBody<QueryBody>(rawBody, isQueryBody);

  if (!body || !body.question.trim()) {
    return errorResponse(requestId, "BAD_REQUEST", "Question is required", 400);
  }

  const timeRange = body.timeRange === 7 || body.timeRange === 14 || body.timeRange === 30 ? body.timeRange : 30;
  const prompt = [
    `Question: ${body.question}`,
    `Dashboard summary: ${summarize(timeRange)}`,
    "Answer in concise business language with concrete numbers from the summary.",
  ].join("\n");

  const geminiResponse = await fetch(`${GEMINI_API}/${MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          { text: "You are a SaaS operations analyst. Keep answers actionable and numerical." },
        ],
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 350,
        temperature: 0.3,
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
