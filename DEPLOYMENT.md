# Deploying to Railway

This is a Next.js (App Router) app with server-side API routes that talk to
MongoDB Atlas and OpenAI, so it deploys as a **Node service** (not a static
site). Railway builds it with Nixpacks and runs `next start`.

## 1. One-time setup

1. **Create the project** — in Railway, *New Project → Deploy from GitHub repo*
   and pick `pdd27673/aries`. Railway detects Next.js via Nixpacks and uses the
   config in [`railway.json`](./railway.json):
   - build: `npm ci` + `npm run build` (Nixpacks default for Node)
   - start: `npm run start` (`next start` — binds to Railway's `$PORT` automatically)
   - health check: `GET /api/sources` (returns 200 without touching Mongo/OpenAI,
     so the container is marked healthy even before the DB is reachable)
   - Node 20, pinned via [`.nvmrc`](./.nvmrc) to match CI

2. **Set environment variables** (service → *Variables*):

   | Variable | Value |
   | --- | --- |
   | `MONGODB_URI` | your Atlas connection string (include the db name, e.g. `…/aries`) |
   | `OPENAI_API_KEY` | your OpenAI key |
   | `OPENAI_MODEL` | `gpt-4.1-nano` (or leave unset for the default) |
   | `GNEWS_API_KEY` | your GNews key (optional; Hacker News works without it) |
   | `ENABLED_SOURCES` | optional, e.g. `gnews,hackernews`; unset = all |

   Do **not** set `PORT` — Railway injects it and `next start` reads it.

3. **Atlas network access** — Railway's egress IPs are dynamic, so add
   `0.0.0.0/0` to the Atlas **Network Access** allowlist (or use a Railway static
   egress IP if you're on a plan that offers one). This is the same allowlist
   issue that bites local dev when your IP changes.

## 2. Auto-deploy on pipeline success

The goal: only deploy a commit to production **after** CI (lint, typecheck,
tests, build) is green. Two ways — pick one.

### Option A — Railway "Wait for CI" (simplest, recommended)

Keep Railway connected to the repo and let it watch `main`, but make it wait for
GitHub checks:

1. Service → *Settings → Deploy* → set **Branch** to `main`.
2. Enable **Wait for CI** (a.k.a. *Check Suites must pass*).

Railway now deploys on every push to `main`, but holds until the `CI` workflow
passes. No secrets in GitHub, nothing else to maintain. Leave `RAILWAY_DEPLOY`
unset so the Actions deploy job below stays dormant.

### Option B — Deploy from GitHub Actions (full control)

Use this if you'd rather Railway **not** auto-build from GitHub and instead have
CI push the deploy. The `deploy` job in
[`.github/workflows/test.yml`](./.github/workflows/test.yml) already does this —
it `needs: build`, so it only runs when the whole pipeline succeeds, and only on
pushes to `main`. It stays dormant until you opt in:

1. In Railway, disable the service's GitHub auto-deploy (so you don't get double
   deploys).
2. Create a **project token**: Railway project → *Settings → Tokens*.
3. In GitHub → repo *Settings → Secrets and variables → Actions*:
   - **Secret** `RAILWAY_TOKEN` = the project token
   - **Variable** `RAILWAY_SERVICE` = your service name (e.g. `aries`)
   - **Variable** `RAILWAY_DEPLOY` = `true` (this is the on-switch for the job)

On the next push to `main` that passes CI, the `deploy` job installs the Railway
CLI and runs `railway up --service <name> --ci` to build & release. Feature
branches and PRs never deploy (the job's `if` is scoped to `main` pushes).

## 3. Verifying a deploy

- Watch the deploy logs in Railway (or the `deploy` job logs in Actions).
- Hit `https://<your-app>.up.railway.app/api/sources` — should return the enabled
  sources as JSON.
- Open the app, run a search, and analyze an article to confirm Atlas + OpenAI
  are wired up. If analyze errors with an SSL/`ECONNREFUSED`/whitelist message,
  re-check the Atlas allowlist (step 1.3) and `MONGODB_URI`.

## Rollback

Railway keeps previous deployments — open the service's *Deployments* tab and
*Redeploy* the last good one. (With Option B you can also re-run the prior
successful `deploy` job from the Actions tab.)
