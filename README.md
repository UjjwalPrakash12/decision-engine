# Decision Engine Dashboard

## Project overview

Decision Engine Dashboard is a Next.js App Router SaaS analytics console that combines deterministic KPI modeling, rule-based business diagnostics, and AI-generated narrative guidance. It is built for fast decision loops: identify an issue, inspect context, simulate scenarios, and execute prioritized actions.

## Tech stack

- Next.js 16 (App Router, Route Handlers, Metadata API)
- React 19 + TypeScript (strict mode)
- Tailwind CSS 4 + custom dark design tokens
- Supabase (Auth + Postgres + RLS)
- Native Web Streams for AI response streaming
- Anthropic Claude API (`claude-3-haiku-20240307`)

## Features

- Interactive KPI + chart dashboard with 7/14/30 day time range
- Rule engine with severity scoring (`info`, `warning`, `critical`)
- Insight side panel with checklist persistence and dismiss controls
- Scenario simulator for revenue/customer/conversion/churn what-if modeling
- AI insight explainer (`/api/explain`) with streaming text responses
- AI action planner (`/api/actions`) generating structured execution steps
- Natural language metric query (`/api/query`) with streamed answers
- SEO metadata, sitemap, robots, loading and error boundaries
- User-scoped metric retrieval from Supabase with RLS

## Architecture

```text
                +-----------------------+
                |   app/page.tsx (UI)   |
                +-----------+-----------+
                            |
           +----------------+----------------+
           |                                 |
  +--------v--------+               +--------v---------+
  | hooks/useMetrics|               | Context Provider |
  | fetch /api/metrics              | selectedRange    |
  +--------+--------+               +------------------+
           |
  +--------v-------------------------------------------+
  | app/api/metrics + Supabase + ruleEngine           |
  | auth user -> load daily_metrics -> evaluateBusiness|
  +--------+-------------------------------------------+
           |
   +-------v-------------------------------------+
   | AI Routes                                   |
   | /api/explain (stream) /api/query (stream)   |
   | /api/actions (JSON plan)                    |
   +-------------------+-------------------------+
                       |
                +------v------+
                | Anthropic   |
                | Claude API  |
                +-------------+
```

## Setup instructions

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env.local
```

3. Add required variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_REFRESH_INTERVAL=30000
MONITORING_WEBHOOK_URL=
```

4. Provision database schema + policies (Supabase SQL editor):

```sql
-- Run the migration at:
-- supabase/migrations/20260427_user_metrics_schema.sql
```

5. Ensure users are authenticated before loading the dashboard.

6. Run dev server:

```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000)

## API documentation

### `GET /api/metrics?days=7|14|30&category=...`

- Requires authenticated user.
- Reads from `public.daily_metrics` for `auth.uid()`.
- Returns sliced metric arrays + evaluated business rules + summary counts.
- If a user has no rows, returns an empty metrics payload (graceful empty state).

### `GET /api/metrics/[id]`

- Requires authenticated user.
- Returns a single metric series (`revenue`, `customers`, `conversionRate`, `churnRate`, `avgOrderValue`) from the user's own data.

### `POST /api/explain`

Body:

```json
{
  "insight": "string",
  "metrics": { "revenue": [1, 2], "customers": [10, 11] },
  "severity": "warning"
}
```

- Streams a plain-text 3-sentence explanation from Claude.
- Includes in-memory rate limiting (10 requests/minute per client IP key).

### `POST /api/actions`

Body:

```json
{
  "results": [],
  "timeRange": 30
}
```

Response:

```json
{
  "plan": [
    {
      "step": 1,
      "title": "Stabilize churn drivers",
      "days": 3,
      "impact": "High",
      "tasks": ["..."]
    }
  ]
}
```

### `POST /api/query`

Body:

```json
{
  "question": "Why did customers dip?",
  "timeRange": 14
}
```

- Streams an AI answer using injected metric summary context.

## Engineering decisions

- **Server-side rule evaluation:** Ensures UI and API share one source of truth.
- **React Context for range state:** Lightweight global state without external libraries.
- **ReadableStream-based AI UX:** Fast perceived responsiveness and better user trust.
- **Session/local storage for panel/task persistence:** Keeps state stable across interactions without backend overhead.
- **User-scoped persistence:** Dashboard data is loaded per authenticated user from Supabase with RLS enforcement.

## Performance goals

- No layout shift on first paint (skeleton placeholders)
- Interaction latency under 100ms for local filtering/simulator updates
- Stream-first AI responses within ~1s network RTT
- Avoid unnecessary rerenders via `useMemo`, `useCallback`, and `React.memo`

## Deployment guide (Vercel)

1. Push repository to Git provider.
2. Import project in Vercel.
3. Set build command: `npm run build` and output: default Next.js.
4. Configure environment variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_REFRESH_INTERVAL`
   - `MONITORING_WEBHOOK_URL`
5. Deploy.

### Common errors and fixes

- **`Missing ANTHROPIC_API_KEY`**  
  Add `ANTHROPIC_API_KEY` in local `.env.local` and Vercel env settings.

- **AI route returns 502**  
  Verify Anthropic key validity and account quota; inspect route logs in Vercel.

- **Rate limit exceeded on explain endpoint**  
  Wait 60 seconds or reduce repeated requests from the same client.

- **Hydration mismatch**  
  Ensure browser-only storage access remains in client components and effect hooks.

- **`Unauthorized` from `/api/metrics`**  
  User is not signed in or auth cookies are missing. Confirm Supabase auth flow and cookie domain settings.

- **Dashboard shows empty arrays**  
  The user has no `daily_metrics` rows yet. Insert rows for that `user_id` (or build CSV import flow).

- **RLS blocks expected reads**  
  Confirm `auth.uid() = user_id` policies exist and `user_id` matches authenticated user UUID.

- **Structured API error responses**  
  API failures now return `{ ok: false, error: { code, message, requestId } }` and `x-request-id`.
  Use `requestId` to correlate server logs and monitoring events.

## Production hardening checks

- Auth checks enforced across all API routes before data access.
- Typed request guards for JSON payload routes (`import`, `query`, `actions`, `data-source`, `explain`).
- Import endpoint rate-limited (per IP in-memory window).
- Structured server-side logging (`level`, `event`, `requestId`, `userId` when available).
- Retry wrapper for transient DB reads/writes on metrics/import/data-source routes.
- Monitoring hooks:
  - `import_failed`
  - `empty_dashboard_data`
- Verify Vercel has all required env vars and RLS policies enabled in Supabase.

## Roadmap

- Persist scenarios and action plans to a backend
- Add org/workspace multi-tenancy
- Add alert subscriptions (email/Slack/webhooks)
- Add deeper attribution breakdowns for rule triggers
- Add E2E tests for AI streaming and simulator outcomes
