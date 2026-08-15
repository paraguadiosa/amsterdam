# Amsterdam — LLM Console Launcher

> **Amster-dam:** the LLM river held by a little HTML dam. Run `amster dump` to open the floodgates.

A static panel to open all LLM billing consoles from one place. No build step, no network calls, no tracking.

## Open the launcher

```bash
./scripts/amster open   # or: xdg-open ./index.html
```

Or open `index.html` in your browser.

## CLI helper

`scripts/amster` is a tiny shell helper:

```bash
./scripts/amster link   # Show the file:// URL of the launcher
./scripts/amster path   # Show the absolute path of the launcher
./scripts/amster open   # Open the launcher with xdg-open
./scripts/amster dump   # Same as open — "open the floodgates"
```

### Install to `~/.local/bin`

A symlink is recommended so the helper always points to the repo's `index.html`:

```bash
ln -s "$PWD/scripts/amster" ~/.local/bin/amster
```

A copy also works:

```bash
install -m 755 scripts/amster ~/.local/bin/amster
```

## Tests

```bash
bats tests/
```

## Configuration

Providers read their API keys from environment variables — never from the repo.
Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

`.env` is git-ignored. If a real key ever lands in a commit, rotate it immediately
(see Security below).

## Security

This repo is public, so secrets are guarded by several layers:

- API keys are only ever read from environment variables.
- `.gitignore` blocks `.env`, certs, and key material.
- [gitleaks](https://github.com/gitleaks/gitleaks) scans the full history and the working tree.
- Git hooks (`.githooks/`) run gitleaks before every commit and push.

Enable the hooks in a fresh clone with:

```bash
git config core.hooksPath .githooks
```

The pre-push hook fails closed: if gitleaks is not installed, the push is refused.

## Notes

- Static, single-page: no external assets, no network calls.
- No tracking, no analytics, no secrets.
- The search box filters cards live.
- "Open console" buttons open each page in a new tab.
