#!/usr/bin/env bats

setup() {
    REPO_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
    HTML="$REPO_DIR/index.html"
    HTML_CONTENT="$(cat "$HTML")"
    CATALOG="$REPO_DIR/src/providers/catalog.js"
    CATALOG_CONTENT="$(cat "$CATALOG")"
}

# ── language ──────────────────────────────────────

@test "html lang is en" {
    [[ "$HTML_CONTENT" == *'lang="en"'* ]]
}

@test "title is Amsterdam Console" {
    [[ "$HTML_CONTENT" == *"<title>Amsterdam Console</title>"* ]]
}

# ── no Spanish remnants ──────────────────────────

@test "no Spanish text in HTML" {
    run grep -iE "consolas de|facturación|filtrar proveedores|abrir consola|se encontró|nunca pegues|lanzador" "$HTML"
    [ "$status" -eq 1 ]
}

# ── amsterdam banner ──────────────────────────────

@test "hero banner exists" {
    [[ "$HTML_CONTENT" == *'class="hero"'* ]]
    [[ "$HTML_CONTENT" == *'class="hero-copy"'* ]]
}

@test "banner dropped the dam wordplay" {
    [[ "$HTML_CONTENT" != *"a dam on the Amstel"* ]]
    [[ "$HTML_CONTENT" != *"HTML dam"* ]]
    [[ "$HTML_CONTENT" != *"The Amstel's dam"* ]]
}

@test "banner shows the amsterdam flag badge" {
    [[ "$HTML_CONTENT" == *'class="flag-badge"'* ]]
    [[ "$HTML_CONTENT" == *"#c8102e"* ]]
}

@test "top flag stripe is present" {
    [[ "$HTML_CONTENT" == *'class="ams-stripe"'* ]]
}

# ── credits remaining ─────────────────────────────

@test "credits panel exists" {
    [[ "$HTML_CONTENT" == *'id="credits"'* ]]
    [[ "$HTML_CONTENT" == *'id="credits-total"'* ]]
    [[ "$HTML_CONTENT" == *'id="credits-split"'* ]]
}

@test "credits total sums live balances" {
    [[ "$HTML_CONTENT" == *"totalCredits"* ]]
    [[ "$HTML_CONTENT" == *"total += p.balance"* ]]
}

@test "credits rendered on every billing update" {
    [[ "$HTML_CONTENT" == *"renderCredits"* ]]
    [[ "$HTML_CONTENT" == *"applyBilling"* ]]
}

@test "credits show split per provider" {
    [[ "$HTML_CONTENT" == *'credits.split'* ]]
}

@test "credits fall back to a hint without balances" {
    [[ "$HTML_CONTENT" == *"No live balances reported yet"* ]]
}

# ── manual credits (providers without a billing API) ──

@test "manual credits are stored per browser" {
    [[ "$HTML_CONTENT" == *"amsterdam.manualCredits"* ]]
    [[ "$HTML_CONTENT" == *"saveManualCredits"* ]]
}

@test "manual credits sync with the server store" {
    [[ "$HTML_CONTENT" == *"api/manual-credits"* ]]
}

@test "manual credits keep a local bootstrap fallback" {
    [[ "$HTML_CONTENT" == *"readLocalManualCredits"* ]]
    [[ "$HTML_CONTENT" == *"localStorage.getItem(MANUAL_STORAGE)"* ]]
}

@test "pi chip shows the manual credit" {
    [[ "$HTML_CONTENT" == *'data.kind === "manual"'* ]]
    [[ "$HTML_CONTENT" == *"data.credit"* ]]
    [[ "$HTML_CONTENT" == *"left"* ]]
}

@test "manual budgets are excluded from the credits total" {
    [[ "$HTML_CONTENT" == *'p.kind === "manual"'* ]]
}

@test "verified chips offer a manual credits editor" {
    [[ "$HTML_CONTENT" == *'class="chip-edit"'* ]]
    [[ "$HTML_CONTENT" == *'class="chip-editor"'* ]]
}

@test "manual credits feed the credits total" {
    [[ "$HTML_CONTENT" == *"manualValue(id)"* ]]
    [[ "$HTML_CONTENT" == *"(manual)"* ]]
}

@test "manual value overrides the verified badge" {
    [[ "$HTML_CONTENT" == *"manualValue(id)"* ]]
    run grep -F 'value: "$" + manual.toFixed(2)' "$HTML"
    [ "$status" -eq 0 ]
}

# ── warning at top ────────────────────────────────

@test "warning appears before billing summary" {
    local warning_line=$(grep -n "Never paste API keys" "$HTML" | head -1 | cut -d: -f1)
    local summary_line=$(grep -n 'id="billing-summary"' "$HTML" | head -1 | cut -d: -f1)
    [ "$warning_line" -lt "$summary_line" ]
}

@test "warning appears before search" {
    local warning_line=$(grep -n "Never paste API keys" "$HTML" | head -1 | cut -d: -f1)
    local search_line=$(grep -n 'id="search"' "$HTML" | head -1 | cut -d: -f1)
    [ "$warning_line" -lt "$search_line" ]
}

@test "only one warning block exists" {
    local count=$(grep -c "Never paste API keys" "$HTML")
    [ "$count" -eq 1 ]
}

# ── billing summary ──────────────────────────────

@test "has billing summary container" {
    [[ "$HTML_CONTENT" == *'id="billing-summary"'* ]]
}

@test "loads the billing snapshot by default" {
    [[ "$HTML_CONTENT" == *'data/billing.js'* ]]
}

@test "demo mode loads the sample fixture" {
    [[ "$HTML_CONTENT" == *'demo/billing.js'* ]]
    [[ "$HTML_CONTENT" == *'var AMS_DEMO'* ]]
    [[ "$HTML_CONTENT" == *'location.search'* ]]
}

@test "has renderSummary function" {
    [[ "$HTML_CONTENT" == *"renderSummary"* ]]
}

@test "has formatChip function" {
    [[ "$HTML_CONTENT" == *"formatChip"* ]]
}

# ── demo mode + onboarding tour ─────────────────

@test "demo mode disables live polling" {
    [[ "$HTML_CONTENT" == *'var live = !AMS_DEMO'* ]]
}

@test "demo status line offers a tour replay" {
    [[ "$HTML_CONTENT" == *'id="tour-replay"'* ]]
    [[ "$HTML_CONTENT" == *'Demo mode'* ]]
}

@test "demo badge is hidden by default" {
    [[ "$HTML_CONTENT" == *'<span class="demo-badge" id="demo-badge" hidden>Sample data</span>'* ]]
}

@test "tour dialog markup exists" {
    [[ "$HTML_CONTENT" == *'id="tour-root" hidden'* ]]
    [[ "$HTML_CONTENT" == *'id="tour-box"'* ]]
    [[ "$HTML_CONTENT" == *'role="dialog"'* ]]
    [[ "$HTML_CONTENT" == *'aria-modal="true"'* ]]
}

@test "tour has skip back and next controls" {
    [[ "$HTML_CONTENT" == *'id="tour-skip"'* ]]
    [[ "$HTML_CONTENT" == *'id="tour-prev"'* ]]
    [[ "$HTML_CONTENT" == *'id="tour-next"'* ]]
}

@test "tour announces progress politely" {
    [[ "$HTML_CONTENT" == *'id="tour-progress" aria-live="polite"'* ]]
}

@test "tour runs once per browser" {
    [[ "$HTML_CONTENT" == *"amsterdam.tourDone"* ]]
    [[ "$HTML_CONTENT" == *'tourSeen'* ]]
}

@test "tour closes on Escape and traps Tab" {
    [[ "$HTML_CONTENT" == *"e.key === 'Escape'"* ]]
    [[ "$HTML_CONTENT" == *"e.key === 'Tab'"* ]]
}

@test "tour restores focus on close" {
    [[ "$HTML_CONTENT" == *'lastFocus.focus()'* ]]
}

@test "tour anchors to the main panels" {
    [[ "$HTML_CONTENT" == *"target: '#credits'"* ]]
    [[ "$HTML_CONTENT" == *"target: '#billing-summary'"* ]]
    [[ "$HTML_CONTENT" == *"target: '#search'"* ]]
    [[ "$HTML_CONTENT" == *"target: '#theme-select'"* ]]
}

@test "has refresh button" {
    [[ "$HTML_CONTENT" == *'id="refresh-btn"'* ]]
}

@test "has billing status element" {
    [[ "$HTML_CONTENT" == *'id="billing-status"'* ]]
}

@test "polls /api/billing" {
    [[ "$HTML_CONTENT" == *"fetch('/api/billing')"* ]]
}

@test "auto-refreshes on an interval" {
    [[ "$HTML_CONTENT" == *"setInterval"* ]]
    [[ "$HTML_CONTENT" == *"REFRESH_INTERVAL_MS"* ]]
}

@test "refresh interval is 2.5 minutes" {
    [[ "$HTML_CONTENT" == *"150000"* ]]
}

@test "shows prompt when no billing data" {
    [[ "$HTML_CONTENT" == *"amster serve"* ]]
    [[ "$HTML_CONTENT" == *"floodgates"* ]]
}

# ── spend is gone, consoles and Grafana remain ──

@test "no spend section or table remains" {
    [[ "$HTML_CONTENT" != *'<section id="spend"'* ]]
    [[ "$HTML_CONTENT" != *'spend-table'* ]]
    [[ "$HTML_CONTENT" != *'mergeSpendRows'* ]]
}

@test "header keeps the Grafana monitoring link" {
    [[ "$HTML_CONTENT" == *'id="grafana-link"'* ]]
    [[ "$HTML_CONTENT" == *'href="http://jacinto.paraguadiosa.com:3005/d/agent-telemetry"'* ]]
}

@test "provider cards link to their consoles" {
    [[ "$HTML_CONTENT" == *'Open console'* ]]
    [[ "$HTML_CONTENT" == *"p.consoleUrl"* ]]
}

# ── charts are gone, Grafana owns visualization ──

@test "no donut or chart containers remain" {
    [[ "$HTML_CONTENT" != *'donut'* ]]
    [[ "$HTML_CONTENT" != *'id="spend-charts"'* ]]
}

@test "Grafana link survives the chart and spend removal" {
    [[ "$HTML_CONTENT" == *'id="grafana-link"'* ]]
}

# ── buttons ───────────────────────────────────────

@test "provider cards open in a new tab" {
    [[ "$HTML_CONTENT" == *'target="_blank" rel="noopener noreferrer"'* ]]
    local count=$(grep -c "consoleUrl:" "$CATALOG")
    [ "$count" -ge 4 ]
}

@test "card buttons say Open console or Open local" {
    [[ "$HTML_CONTENT" == *"'Open console'"* ]]
    [[ "$HTML_CONTENT" == *"'Open local'"* ]]
}

# ── themes ─────────────────────────────────────

@test "theme registry script loads in head" {
    [[ "$HTML_CONTENT" == *'src="src/themes.js"'* ]]
}

@test "theme picker is a native select dropdown" {
    [[ "$HTML_CONTENT" == *'id="theme-select"'* ]]
    [[ "$HTML_CONTENT" == *'<select'* ]]
    [[ "$HTML_CONTENT" == *'addEventListener("change"'* ]]
}

@test "theme choice persists in localStorage" {
    [[ "$HTML_CONTENT" == *'amsterdam.theme'* ]]
}

@test "auto mode follows the clock" {
    [[ "$HTML_CONTENT" == *'effectiveTheme'* ]]
    [[ "$HTML_CONTENT" == *'setInterval'* ]]
}

@test "palettes live in the registry, not in index.html" {
    local registry="$REPO_DIR/src/themes.js"
    local count=$(grep -c 'label:' "$registry")
    [ "$count" -eq 4 ]
    run grep -F '[data-theme="day"]' "$HTML"
    [ "$status" -eq 1 ]
}

# ── footer ────────────────────────────────────────

@test "footer says Amsterdam Console" {
    [[ "$HTML_CONTENT" == *"Amsterdam Console"* ]]
}

# ── script ────────────────────────────────────────

@test "JavaScript search handler exists" {
    [[ "$HTML_CONTENT" == *'addEventListener("input"'* ]]
}

@test "JavaScript uses querySelectorAll for cards" {
    [[ "$HTML_CONTENT" == *'querySelectorAll(".card")'* ]]
}

# ── Grafana link ─────────────────────────────────

@test "console links to Grafana at the top" {
    [[ "$HTML_CONTENT" == *'class="hero-nav"'* ]]
    [[ "$HTML_CONTENT" == *'Grafana'* ]]
    [[ "$HTML_CONTENT" == *'id="grafana-link"'* ]]
    [[ "$HTML_CONTENT" == *'href="http://jacinto.paraguadiosa.com:3005/d/agent-telemetry"'* ]]
}

@test "usage page is gone" {
    [[ ! -f "$REPO_DIR/usage.html" ]]
}
