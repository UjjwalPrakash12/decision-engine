import { NextResponse } from "next/server";
import type { BusinessResult } from "@/lib/ruleEngine";
import { errorResponse, parseJsonBody, requestIdFrom } from "@/lib/api";

const MODEL = "gemini-2.0-flash";
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

type ActionPlanStep = {
  step: number;
  title: string;
  days: number;
  impact: "Low" | "Medium" | "High";
  tasks: string[];
};

type ActionPlanResponse = {
  plan: ActionPlanStep[];
};

type RequestBody = {
  results: BusinessResult[];
  timeRange: number;
};

function isRequestBody(v: unknown): v is RequestBody {
  if (!v || typeof v !== "object") return false;
  const b = v as Partial<RequestBody>;
  return Array.isArray(b.results) && Number.isFinite(b.timeRange);
}

function fallbackPlan(results: BusinessResult[]): ActionPlanResponse {
  const top = results.slice(0, 3);
  return {
    plan: [
      {
        step: 1,
        title: "Stabilize critical metrics",
        days: 3,
        impact: "High",
        tasks: top.length
          ? top.map((r) => `Address: ${r.name}`)
          : ["Review dashboard health and identify immediate risks"],
      },
      {
        step: 2,
        title: "Execute targeted fixes",
        days: 7,
        impact: "Medium",
        tasks: ["Run controlled experiments", "Track day-over-day improvement"],
      },
    ],
  };
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

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  return trimmed;
}

export async function POST(request: Request): Promise<NextResponse> {
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
  const body = parseJsonBody<RequestBody>(rawBody, isRequestBody);

  if (!body) {
    return errorResponse(requestId, "BAD_REQUEST", "Invalid payload", 400);
  }

  const prompt = [
    "Create an action plan in strict JSON with this schema only:",
    '{ "plan": [{ "step": number, "title": string, "days": number, "impact": "Low" | "Medium" | "High", "tasks": string[] }] }',
    "Return 3-5 ordered steps.",
    `Time range: ${body.timeRange} days.`,
    `Insights: ${JSON.stringify(body.results.slice(0, 8))}`,
  ].join("\n");

  try {
    const res = await fetch(`${GEMINI_API}/${MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "You produce concise, implementation-ready growth plans for SaaS teams." }],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.3,
        },
      }),
    });

    if (!res.ok) {
      return NextResponse.json(fallbackPlan(body.results), { status: 200 });
    }

    const json = (await res.json()) as unknown;
    const text = stripCodeFence(extractGeminiText(json));
    const parsed = JSON.parse(text) as ActionPlanResponse;

    if (!Array.isArray(parsed.plan)) {
      return NextResponse.json(fallbackPlan(body.results), { status: 200 });
    }

    return NextResponse.json(
      {
        plan: parsed.plan.map((p, index) => ({
          step: Number.isFinite(p.step) ? p.step : index + 1,
          title: String(p.title || `Step ${index + 1}`),
          days: Number.isFinite(p.days) ? p.days : 3,
          impact:
            p.impact === "High" || p.impact === "Medium" || p.impact === "Low"
              ? p.impact
              : "Medium",
          tasks: Array.isArray(p.tasks) ? p.tasks.map(String) : [],
        })),
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(fallbackPlan(body.results), { status: 200 });
  }
}
