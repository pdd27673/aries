# News Analysis

Search recent news, generate an AI **summary** + **sentiment** (positive / neutral /
negative) for an article in one click, store the result, and browse the full analysis
history. Built with Next.js (App Router), TypeScript, MongoDB (Mongoose), and OpenAI.

---

## Setup

**Requirements:** Node 24+ (see [`.nvmrc`](./.nvmrc)), a MongoDB connection string, a
[GNews](https://gnews.io) API key (free tier: 100 req/day), and an OpenAI API key.

```bash
npm install
cp .env.example .env        # then fill in the values
npm run dev                 # http://localhost:3000
```

`.env` values:

| Var | What it is |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `GNEWS_API_KEY` | GNews API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Defaults to `gpt-4.1-nano` |
| `ENABLED_SOURCES` | Comma-separated source ids to enable. Unset = all. e.g. `gnews,hackernews` |

**Other commands:** `npm run build`, `npm start`, `npm test`.

---

## How it works (the flow)

1. **Search** — a query and selected source drive `GET /api/search`, which asks the chosen
   source adapter for matching articles.
2. **Analyze** — clicking *Analyze* on a result sends `POST /api/analyze`, which checks
   whether that URL has already been analyzed; if not, it makes **one** OpenAI call that
   returns both the summary and the sentiment as JSON, then stores the result.
3. **History** — `GET /api/analyses` lists everything the current session has analyzed,
   filterable by sentiment and sortable by date.

## Architecture

The app is layered **route → service → core**, and the rule is simple:

- **`app/api/*/route.ts`** — thin HTTP handlers. They validate input, call one service
  function, and shape the response. No business logic.
- **`services/*`** — orchestration. Each function composes core modules to satisfy one
  endpoint's job (e.g. `analyze` = cache lookup → OpenAI → save).
- **`core/*`** — self-contained building blocks that don't know HTTP exists: the source
  adapters, the OpenAI client, the Mongoose models, and small utils (retry, errors).

### File tree

```
app/
  page.tsx                 Search → results → Analyze → summary/sentiment card
  history/page.tsx         History view (filter by sentiment, sort by date)
  api/
    search/route.ts        GET  /api/search?q=&source=
    analyze/route.ts       POST /api/analyze
    analyses/route.ts      GET  /api/analyses?sentiment=&sort=
    sources/route.ts       GET  /api/sources   (for the source picker)
    quota/route.ts         GET  /api/quota     (GNews usage today)

core/
  sources/
    types.ts               NewsSourceAdapter interface + Article shape (the contract)
    registry.ts            central list of sources + ENABLED_SOURCES filter
    gnews.ts               GNews adapter (default)
    rss.ts                 Hacker News RSS adapter (second source)
  ai/openai.ts             one combined summary+sentiment call, output validated
  db/
    connect.ts             cached Mongoose connection (hot-reload safe)
    analysis.model.ts      stored analysis schema + indexes
    quota.model.ts         per-source/day call counter
  util/
    retry.ts               retry-with-backoff wrapper for external calls
    errors.ts              ConfigError / UpstreamError + HTTP status mapping

services/                  one file per use case (search, analyze, analyses, sources, quota)
components/                small React pieces (SentimentBadge, AnalysisCard, SourcePicker, QuotaBadge)
lib/types.ts               client-side types (kept separate from server core types)
__tests__/                 adapter contract tests + analyze-service test (OpenAI mocked)
```

### Config-driven news sources

The whole app talks to news sources through **one interface** (`core/sources/types.ts`):

```ts
interface NewsSourceAdapter {
  id: string;                                          // machine id, used in ENABLED_SOURCES
  displayName: string;                                 // label for the source picker
  search(query: string, limit: number): Promise<Article[]>;
}
```

Every adapter maps its own API/feed into the shared `Article` shape, so nothing downstream
knows GNews from Hacker News. `core/sources/registry.ts` holds the list of known sources
and filters it by the `ENABLED_SOURCES` env var. The rest of the app only ever reads from
that registry.

**Adding a source touches exactly two files** — a new adapter that implements the
`NewsSourceAdapter` interface, and one line registering it in `core/sources/registry.ts`.

### Data model

Analyses are stored as flat documents — no joins, shaped the way they're queried:

```
{ session, url, title, summary, sentiment, source, analyzedAt }
```

`session` is an anonymous per-browser id (an httpOnly `sid` cookie set on first analyze).
Every analysis is tagged with it and the History view filters by it, so each visitor sees
only their own results, keeping sessions isolated when several people share one deployment. `(session, url)`
is unique: it's the article's identity **and** the per-session cache key, so re-analyzing an
already-analyzed article returns the stored result instead of calling OpenAI again (saves
cost and GNews quota). Compound indexes on `{ session, analyzedAt }` and
`{ session, sentiment, analyzedAt }` back the History view's filter + sort.

---

## Deploying

This is a **Node service** (server-side API routes hitting MongoDB + OpenAI), not a static
site — host it anywhere that runs `next start` (Railway, Render, Vercel). Set the
environment variables from the table above in the host's dashboard and deploy.
[`railway.json`](./railway.json) pins the start command and a `GET /api/sources` health
check that returns 200 without touching Mongo or OpenAI, so the container is reported healthy
before the database is reachable. Missing configuration surfaces as a clear API error rather
than a crash, so a partially configured deploy degrades gracefully.
