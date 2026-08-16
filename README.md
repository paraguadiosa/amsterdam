# Amsterdam Console

> **Amsterdam:** the LLM river held by a HTML dam. Run `amsterdam` to open the gates.

A static panel to open all LLM billing consoles from one place — with
live balance and usage numbers fetched straight from provider APIs.

## Quick start

### Default: host daemon (fast iteration)

```bash
./scripts/amsterdam-install   # symlink amsterdam into ~/.local/bin (once)
amsterdam                     # start the daemon in the background, print the URL
```

The first `amsterdam` starts the host daemon in the background (the command
returns to the prompt immediately) and prints the live URL
(<http://localhost:3131>). It does not open a browser on that first call.
When the daemon is already running, `amsterdam` opens the live dashboard in
your browser instead. Use `amsterdam serve` for a foreground debug daemon
(Ctrl+C to stop).

### Opt-in: Docker container

```bash
amsterdam docker    # background container, then print the URL
amsterdam stop      # stop the container
```

The Docker image is rebuilt on `amsterdam build`. Prefer the daemon while
iterating on code — the container runs the code baked at build time.

For a one-shot snapshot instead:

```bash
./scripts/amster dump    # fetch billing data once, write data/billing.js
./scripts/amster open    # open the static dashboard (file://)
```

## CLI helper

```bash
amsterdam               # Start the daemon in the background, or open the dashboard
amsterdam serve         # Foreground debug daemon (Ctrl+C to stop)
amsterdam start         # Start the daemon in the background (same as no arguments)
amsterdam status        # Show whether the host daemon is running
amsterdam open          # Open the dashboard in a browser
amsterdam docker        # Background Docker container, then print the URL
amsterdam up            # Same as docker
amsterdam stop          # Stop the background container
amsterdam build         # Build the Docker image
amsterdam run           # Run Docker in the foreground (Ctrl+C to stop)
amsterdam dump          # Fetch billing data once (open the floodgates)
amsterdam link          # Show the file:// URL
amsterdam path          # Show the absolute path
amsterdam help          # Show help
```

The wrapper starts the host daemon by default, passes `docker|up|stop|build|run`
to `scripts/amster-docker`, and the rest to `scripts/amster`. The low-level
helpers work the same way:

```bash
./scripts/amster start    # Start the daemon in the background, print the URL
./scripts/amster status   # Show whether the daemon is running
./scripts/amster stop     # Stop the background daemon
./scripts/amster serve    # Live server in the foreground (Ctrl+C to stop)
./scripts/amster dump     # Fetch billing data once (open the floodgates)
./scripts/amster open     # Open the dashboard in a browser
./scripts/amster link     # Show the file:// URL
./scripts/amster path     # Show the absolute path
./scripts/amster help     # Show help
```

The daemon state lives in `data/` (gitignored): `data/amsterdam.pid` holds the
pid of the background daemon and `data/amsterdam.log` its output. `amster stop`
reads the pidfile and kills exactly that process. The port is the `PORT`
environment variable when set, otherwise 3131. Override the browser opener
with `AMSTERDAM_OPEN` (default `xdg-open`) for headless use.

### Live mode vs static mode

| Mode | Command | Data | Refresh |
|------|---------|------|---------|
| Live | `amster serve` | `/api/billing` endpoint | Every 2.5 min, plus manual Refresh button |
| Static | `amster dump` + `amster open` | `data/billing.js` | None (snapshot) |

The dashboard detects how it is served. Over HTTP it polls `/api/billing`
and shows a live status; over `file://` it renders the static snapshot and
suggests `amster serve`. `amster open` opens the live URL when the daemon is
running and falls back to the static file otherwise.

### Credits remaining

The dashboard leads with a big **Credits remaining** panel: the live sum of
all provider balances with real billing APIs (DeepSeek, Moonshot), plus a
per-provider split. It updates with every 2.5-minute auto-refresh, so the
number on screen is always how much money is left in the accounts.

Providers without a billing API (the verified-only providers) cannot
report a balance — the API simply has no public credits endpoint (this is
why Anthropic was purged from the console). For those, click **edit** on
the chip and type the remaining amount once; it is stored in the browser,
shown as a USD value, and added to the total (marked *manual* in the
split).

### Spend by model

The dashboard shows spend from two sources, side by side:

**Hermes — estimated.** The local Hermes agent state database at
`~/.hermes/state.db` (read-only, host daemon only). Amsterdam never writes
to that database. The data is aggregated per `(model, billing_provider)`:
sessions, calls, tokens, and estimated/actual cost. Only rows whose cost
status is `estimated` count toward the Hermes total; untrusted snapshots
(for example a bad pricing row marked `unknown`) are excluded from the
total and shown as `n/a`. Override the database path with `HERMES_STATE_DB`.

**Pi sessions — actual.** Pi (pi.dev CLI) writes one JSONL file per session
under `~/.pi/agent/sessions`. Every assistant message carries the provider,
model, tokens, and real USD cost. Amsterdam aggregates per `(model,
provider)` and per project (the basename of the session working directory;
home-directory sessions count as `home`). Override the sessions directory
with `PI_SESSIONS_DIR`. Pi costs are billed amounts, so they always show as
USD — never `n/a`. When the directory is missing, the section is hidden.

In Docker there is no Hermes state DB and no Pi sessions, so the spend
sections stay empty — run `amster serve` on the host to see spend data.

The table is sortable by clicking any column header (default: est. cost desc).
Click **Columns** to choose which columns are visible — the choice is saved
per browser. Local GGUF files in `~/models` appear in the table even without
recorded usage, marked with status `no usage`. Groups with usage but no
recorded cost get a token-based estimate when the model has an authoritative
rate (deepseek-v4-flash, deepseek-v4-pro); local GGUF runs show as `free`.
Models without a known rate keep `n/a`.

Anthropic is purged at the data layer: rows from the `anthropic` billing
provider and any `claude-*` model are dropped from the aggregation, the
totals, and the CLI output — wherever the spend data goes.

### Install to `~/.local/bin`

```bash
./scripts/amsterdam-install
```

This symlinks `amsterdam`, `amster`, and `amster-docker` into
`~/.local/bin`. The scripts resolve symlinks, so they work from any
directory and keep working after repo updates.

## Architecture

```
src/
  providers/
    deepseek.js      # Balance endpoint (has real billing API)
    moonshot.js      # Balance endpoint (has real billing API)
    huggingface.js   # Whoami endpoint (account info)
    verify.js        # Factory for key-verification-only providers
    index.js         # Provider registry
  dam.js             # Orchestrator — fetches all, writes data/billing.js
  server.js          # Local HTTP server for live mode
  env.js             # Credential loader (.env files + hermes pool)
  spend.js           # Read-only per-model spend from the Hermes state DB
  pi-spend.js        # Read-only spend from Pi session logs
  format.js          # Output formatters (JS file + console)
data/
  billing.js         # Auto-generated (gitignored)
index.html           # Dashboard — reads data/billing.js and /api/billing
Dockerfile           # Container build (node:22-alpine, runs as non-root)
.dockerignore        # Keeps the build context small
scripts/
  amster             # CLI entry point (serve, dump, open, ...)
  amsterdam          # Wrapper: default to host daemon, Docker via `amsterdam docker`
  amsterdam-install  # Symlink the commands into ~/.local/bin
  amster-docker      # Docker build/run helper
```

### Provider types

| Type | Providers | What it returns |
|------|-----------|-----------------|
| Balance API | DeepSeek, Moonshot | Actual balance numbers |
| Account info | Hugging Face | Username + verified status |
| Key verification + model count | OpenAI, Groq, Together, Mistral, Google, Fireworks | Number of models + `verified: true` on HTTP 200 |

## Credentials — one place to keep them

Amsterdam reads credentials from three sources, in order. The first
source that defines a variable wins:

1. `process.env` (already exported in your shell)
2. `./.env` in the project directory
3. `~/.hermes/.env`
4. **`~/.hermes/auth.json`** — the hermes credential pool

The hermes credential pool is the recommended source. Keys added with
`hermes auth add <provider> --api-key <key>` are picked up automatically.
Hermes provider ids are mapped to amsterdam variables (e.g.
`kimi-coding` → `KIMI_API_KEY`).
Only manual credentials carry a token; env-sourced ones resolve through
the `.env` files above. The pool's `base_url` is also honored for
providers that read one (`KIMI_BASE_URL`, `DEEPSEEK_BASE_URL`, `GROQ_BASE_URL`),
with the OpenAI-style trailing `/v1` stripped.

So you maintain your keys in **one place** (`hermes auth`), and amsterdam
detects them without duplicating them in a project `.env`.

## Tests

```bash
npm test              # Node.js tests with coverage (fails below 80% lines)
npm run test:shell    # Shell + HTML tests (bats)
npm run test:all      # Both
```

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push and pull request:

1. **Test** — installs dependencies, runs Node tests (80% coverage gate)
   and the bats suite.
2. **Docker** — builds the image and smoke-tests `/` and `/api/billing`.

Once pushed to GitHub, add a status badge (replace `OWNER` with your
account or org):

```markdown
[![CI](https://github.com/OWNER/amsterdam/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/amsterdam/actions/workflows/ci.yml)
```

## Notes

- Single HTML file, no build step, no bundler.
- The hero banner is an Amsterdam canal scene: gabled houses, a moon over
  the water, a canal boat, and the city flag (red-black-red with the XXX).
  A short verse sits in the banner, and a full sonnet hides in the footer.
- No secrets stored — keys come from environment variables or the
  hermes credential pool (`~/.hermes/auth.json`), never from git.
- Spend by model reads `~/.hermes/state.db` (the Hermes agent's state DB)
  in read-only mode, and Pi spend reads `~/.pi/agent/sessions` (Pi session
  logs); neither is ever mounted into the Docker container (WAL/shm and
  per-session file issues), so spend data is host-daemon-only.
- The container runs as a non-root user and mounts the keys file read-only.
- The search box filters cards live.
- "Available platforms" is a collapsible dropdown (click to expand).
- "Open console" buttons open each page in a new tab.
- The repo is local-only: no remotes, no push.
