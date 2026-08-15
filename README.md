# LLM Console Launcher

> **Amster-dam:** the LLM river held by a little HTML dam. Run `amster dump` to open the floodgates.

A static panel to open all LLM billing consoles from one place.

## Open the launcher

```bash
xdg-open /home/eve/Coding_Projects/amsterdam/index.html
```

Or open `index.html` with your browser (double-click in the file manager).

## Optional CLI helper

The repo includes `scripts/amster`, a shell helper. Use it directly from
the repo:

```bash
./scripts/amster link   # Show the file:// URL of the launcher
./scripts/amster path   # Show the absolute path of the launcher
./scripts/amster open   # Open the launcher with xdg-open
./scripts/amster dump   # Same as open — "open the floodgates"
```

### Install to `~/.local/bin`

A symlink is recommended so the helper always points to the repo's
`index.html`:

```bash
ln -s "$PWD/scripts/amster" ~/.local/bin/amster
```

A copy also works. If `scripts/amster` cannot find the `index.html`
relative to itself, it falls back to the absolute path
`/home/eve/Coding_Projects/amsterdam/index.html`:

```bash
install -m 755 scripts/amster ~/.local/bin/amster
```

## Tests

```bash
bats tests/
```

## Notes

- Single file, no external assets, no network calls.
- Contains no secrets or API keys.
- The search box filters cards live.
- "Open console" buttons open each page in a new tab.
- The repo is local-only: no remotes, no push.
