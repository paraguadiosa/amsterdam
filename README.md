# Amsterdam Console

> **Amsterdam:** the LLM river held by a HTML dam. Run `amsterdam` to open the gates.

A static panel to open all LLM billing consoles from one place — with
live balance and usage numbers fetched straight from provider APIs.

## Quick start

### One command, anywhere

```bash
./scripts/amsterdam-install   # symlink amsterdam into ~/.local/bin (once)
amsterdam                     # build the image if needed, run in the background
```

Then open <http://localhost:3131>. Stop it with `amsterdam stop`.
Any new terminal can run `amsterdam` — it is a symlink on your PATH.

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
amsterdam               # Background Docker container, then print the URL
amsterdam stop          # Stop the background container
amsterdam build         # Build the Docker image
amsterdam run           # Run in the foreground (Ctrl+C to stop)
amsterdam serve         # Live server without Docker, auto-refresh every 2.5 min
amsterdam dump          # Fetch billing data once (open the floodgates)
amsterdam open          # Open the launcher with xdg-open
amsterdam link          # Show the file:// URL
amsterdam path          # Show the absolute path
amsterdam help          # Show help
```

The wrapper passes Docker commands to `scripts/amster-docker` and the
rest to `scripts/amster`. The low-level helpers work the same way:

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
    openrouter.js    # Auth/key endpoint (has real billing API)
    huggingface.js   # Whoami endpoint (account info)
    verify.js        # Factory for key-verification-only providers
    index.js         # Provider registry
  dam.js             # Orchestrator — fetches all, writes data/billing.js
  server.js          # Local HTTP server for live mode
  env.js             # Credential loader (.env files + hermes pool)
  format.js          # Output formatters (JS file + console)
data/
  billing.js         # Auto-generated (gitignored)
index.html           # Dashboard — reads data/billing.js and /api/billing
Dockerfile           # Container build (node:22-alpine, runs as non-root)
.dockerignore        # Keeps the build context small
scripts/
  amster             # CLI entry point (serve, dump, open, ...)
  amsterdam          # Wrapper: default to background Docker, pass through to amster
  amsterdam-install  # Symlink the commands into ~/.local/bin
  amster-docker      # Docker build/run helper
```

### Provider types

| Type | Providers | What it returns |
|------|-----------|-----------------|
| Balance API | DeepSeek, OpenRouter | Actual balance / usage numbers |
| Account info | Hugging Face | Username + verified status |
| Key verification | Anthropic, OpenAI, Moonshot, Groq, Together, Mistral, Google, Fireworks | `verified: true` on HTTP 200 |

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
`kimi-coding` → `KIMI_API_KEY`, `anthropic` → `ANTHROPIC_API_KEY`).
Only manual credentials carry a token; env-sourced ones resolve through
the `.env` files above.

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
- No secrets stored — keys come from environment variables or the
  hermes credential pool (`~/.hermes/auth.json`), never from git.
- The container runs as a non-root user and mounts the keys file read-only.
- The search box filters cards live.
- "If you also use these" is a collapsible dropdown (click to expand).
- "Open console" buttons open each page in a new tab.
- The repo is local-only: no remotes, no push.
