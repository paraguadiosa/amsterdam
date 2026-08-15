# Amsterdam Console

> **Amster-dam:** the LLM river held by a little HTML dam. Run `amster dump` to open the floodgates.

A static panel to open all LLM billing consoles from one place — with
live balance and usage numbers fetched straight from provider APIs.

## Quick start

### Docker (recommended)

```bash
./scripts/amster-docker build   # build the image once
./scripts/amster-docker up      # start in the background
```

Then open <http://localhost:3131>. Stop it with `./scripts/amster-docker stop`.

The helper mounts your API keys file (default `~/.hermes/.env`) into the
container read-only. Override it if your keys live elsewhere:

```bash
AMSTERDAM_ENV_FILE=~/.env ./scripts/amster-docker run
```

### Without Docker

```bash
npm install
./scripts/amster serve   # live dashboard with auto-refresh every 2.5 min
```

Then open <http://localhost:3131> (the port is a nod to the Netherlands'
calling code +31).

For a one-shot snapshot instead:

```bash
./scripts/amster dump    # fetch billing data once, write data/billing.js
./scripts/amster open    # open the static dashboard (file://)
```

## CLI helper

```bash
./scripts/amster serve   # Live server, auto-refresh every 2.5 min
./scripts/amster dump    # Fetch billing data once (open the floodgates)
./scripts/amster open    # Open the launcher with xdg-open
./scripts/amster link    # Show the file:// URL
./scripts/amster path    # Show the absolute path
./scripts/amster help    # Show help
```

### Live mode vs static mode

| Mode | Command | Data | Refresh |
|------|---------|------|---------|
| Live | `amster serve` | `/api/billing` endpoint | Every 2.5 min, plus manual Refresh button |
| Static | `amster dump` + `amster open` | `data/billing.js` | None (snapshot) |

The dashboard detects how it is served. Over HTTP it polls `/api/billing`
and shows a live status; over `file://` it renders the static snapshot and
suggests `amster serve`.

### Install to `~/.local/bin`

```bash
ln -s "$PWD/scripts/amster" ~/.local/bin/amster
ln -s "$PWD/scripts/amster-docker" ~/.local/bin/amster-docker
```

## Architecture

```
src/
  providers/
    deepseek.js      # Balance endpoint (has real billing API)
    openrouter.js    # Auth/key endpoint (has real billing API)
    huggingface.js   # Whoami endpoint (account info)
    verify.js        # Factory for key-verification-only providers
    index.js         # Provider registry
  dam.js             # Orchestrator — fetches all, writes data/billing.js
  server.js          # Local HTTP server for live mode
  env.js             # Minimal .env file loader
  format.js          # Output formatters (JS file + console)
data/
  billing.js         # Auto-generated (gitignored)
index.html           # Dashboard — reads data/billing.js and /api/billing
Dockerfile           # Container build (node:22-alpine, runs as non-root)
.dockerignore        # Keeps the build context small
scripts/
  amster             # CLI entry point
  amster-docker      # Docker build/run helper
```

### Provider types

| Type | Providers | What it returns |
|------|-----------|-----------------|
| Balance API | DeepSeek, OpenRouter | Actual balance / usage numbers |
| Account info | Hugging Face | Username + verified status |
| Key verification | Anthropic, OpenAI, Moonshot, Groq, Together, Mistral, Google, Fireworks | `verified: true` on HTTP 200 |

## Tests

```bash
npm test              # Node.js tests with coverage
npm run test:shell    # Shell + HTML tests (bats)
npm run test:all      # Both
```

## Notes

- Single HTML file, no build step, no bundler.
- No secrets stored — keys come from environment variables.
- The container runs as a non-root user and mounts the keys file read-only.
- The search box filters cards live.
- "If you also use these" is a collapsible dropdown (click to expand).
- "Open console" buttons open each page in a new tab.
- The repo is local-only: no remotes, no push.
