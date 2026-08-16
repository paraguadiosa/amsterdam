#!/usr/bin/env bats

setup() {
    REPO_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
    HTML="$REPO_DIR/index.html"
    HTML_CONTENT="$(cat "$HTML")"
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

@test "banner references the Amstel dam" {
    [[ "$HTML_CONTENT" == *"a dam on the Amstel"* ]]
}

@test "banner shows the amsterdam flag badge" {
    [[ "$HTML_CONTENT" == *'class="flag-badge"'* ]]
    [[ "$HTML_CONTENT" == *"#c8102e"* ]]
}

@test "banner carries the dam metaphor" {
    [[ "$HTML_CONTENT" == *"HTML dam"* ]]
    [[ "$HTML_CONTENT" == *"The Amstel's dam once made this town"* ]]
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

@test "loads data/billing.js script" {
    [[ "$HTML_CONTENT" == *'src="data/billing.js"'* ]]
}

@test "has renderSummary function" {
    [[ "$HTML_CONTENT" == *"renderSummary"* ]]
}

@test "has formatChip function" {
    [[ "$HTML_CONTENT" == *"formatChip"* ]]
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

# ── spend by model ────────────────────────────────

@test "has spend by model section" {
    [[ "$HTML_CONTENT" == *"Spend by model"* ]]
}

@test "spend section sits between summary and search" {
    local summary_line=$(grep -n 'id="billing-summary"' "$HTML" | head -1 | cut -d: -f1)
    local spend_line=$(grep -n 'id="spend-table"' "$HTML" | head -1 | cut -d: -f1)
    local search_line=$(grep -n '<input id="search"' "$HTML" | head -1 | cut -d: -f1)
    [ "$spend_line" -gt "$summary_line" ]
    [ "$spend_line" -lt "$search_line" ]
}

@test "spend table lists expected columns" {
    [[ "$HTML_CONTENT" == *"Est. cost"* ]]
    [[ "$HTML_CONTENT" == *"Tokens out"* ]]
    [[ "$HTML_CONTENT" == *"Sessions"* ]]
}

@test "spend table has provider and model columns" {
    [[ "$HTML_CONTENT" == *'<th scope="col" data-sort-key="model">Model'* ]]
    [[ "$HTML_CONTENT" == *'<th scope="col" data-sort-key="provider">Provider'* ]]
}

@test "all 8 spend columns carry a data-sort-key" {
    local count=$(grep -o 'data-sort-key="' "$HTML" | wc -l)
    [ "$count" -eq 8 ]
}

@test "spend sort handler is delegated on the table head" {
    [[ "$HTML_CONTENT" == *'#spend-table thead'* ]]
    [[ "$HTML_CONTENT" == *'addEventListener("click", sortHandler)'* ]]
}

@test "spend sort state survives re-renders" {
    [[ "$HTML_CONTENT" == *"sortState"* ]]
    [[ "$HTML_CONTENT" == *"renderSpend(window.BILLING)"* ]]
}

@test "spend sort indicator markup exists" {
    [[ "$HTML_CONTENT" == *'class="sort-indicator"'* ]]
    [[ "$HTML_CONTENT" == *"updateSortIndicator"* ]]
}

@test "spend shows unavailable hint for missing DB" {
    [[ "$HTML_CONTENT" == *"Spend data unavailable"* ]]
    [[ "$HTML_CONTENT" == *"amster serve"* ]]
}

@test "spend shows empty hint for no usage" {
    [[ "$HTML_CONTENT" == *"No usage recorded yet"* ]]
}

@test "has renderSpend function" {
    [[ "$HTML_CONTENT" == *"renderSpend"* ]]
}

@test "has formatSpendCost function" {
    [[ "$HTML_CONTENT" == *"formatSpendCost"* ]]
}

@test "spend cost shows n/a for unknown status" {
    [[ "$HTML_CONTENT" == *"costStatus !== 'estimated'"* ]]
    [[ "$HTML_CONTENT" == *"n/a"* ]]
}

@test "local models show free instead of n/a" {
    [[ "$HTML_CONTENT" == *"return 'free'"* ]]
    [[ "$HTML_CONTENT" == *"costStatus === 'local'"* ]]
}

@test "model counts are no longer shown as chips" {
    run grep -F "10 models" "$HTML"
    [ "$status" -eq 1 ]
}

# ── spend by Pi ─────────────────────────────────

@test "has spend by Pi section" {
    [[ "$HTML_CONTENT" == *"Spend by Pi"* ]]
}

@test "pi spend table exists" {
    [[ "$HTML_CONTENT" == *'id="pi-spend-table"'* ]]
    [[ "$HTML_CONTENT" == *'aria-label="Spend by Pi"'* ]]
}

@test "pi spend summary line markup exists" {
    [[ "$HTML_CONTENT" == *'id="pi-summary"'* ]]
    [[ "$HTML_CONTENT" == *"Pi total"* ]]
    [[ "$HTML_CONTENT" == *"Hermes total"* ]]
}

@test "pi spend section sits between spend table and search" {
    local spend_line=$(grep -n 'id="spend-empty"' "$HTML" | head -1 | cut -d: -f1)
    local pi_line=$(grep -n 'id="pi-spend-section"' "$HTML" | head -1 | cut -d: -f1)
    local search_line=$(grep -n '<input id="search"' "$HTML" | head -1 | cut -d: -f1)
    [ "$pi_line" -gt "$spend_line" ]
    [ "$pi_line" -lt "$search_line" ]
}

@test "pi spend table lists expected columns" {
    [[ "$HTML_CONTENT" == *"<th scope=\"col\">Last seen</th>"* ]]
    [[ "$HTML_CONTENT" == *"<th scope=\"col\">Tokens</th>"* ]]
    [[ "$HTML_CONTENT" == *"<th scope=\"col\">Cost</th>"* ]]
}

@test "pi spend rows reuse mono and cost styling" {
    [[ "$HTML_CONTENT" == *'class="cost"'* ]]
    [[ "$HTML_CONTENT" == *'class="model"'* ]]
}

@test "renderPiSpend is called from applyBilling" {
    [[ "$HTML_CONTENT" == *"renderPiSpend(billing)"* ]]
}

@test "pi spend table is not wired to the sort handler" {
    run grep -F '#pi-spend-table thead' "$HTML"
    [ "$status" -eq 1 ]
}

# ── column picker ────────────────────────────────

@test "column picker button exists with aria controls" {
    [[ "$HTML_CONTENT" == *'id="columns-btn"'* ]]
    [[ "$HTML_CONTENT" == *'aria-expanded="false"'* ]]
    [[ "$HTML_CONTENT" == *'aria-controls="columns-panel"'* ]]
}

@test "column picker has 8 checkboxes" {
    local count=$(grep -o 'data-col="' "$HTML" | wc -l)
    [ "$count" -eq 8 ]
}

@test "column picker shows name and price by default" {
    [[ "$HTML_CONTENT" == *'data-col="model" checked'* ]]
    [[ "$HTML_CONTENT" == *'data-col="estimatedCostUsd" checked'* ]]
}

@test "column choice persists in localStorage" {
    [[ "$HTML_CONTENT" == *'amsterdam.columns'* ]]
}

@test "renderSpend toggles th visibility per column state" {
    [[ "$HTML_CONTENT" == *'th.hidden = !columnState['* ]]
}

@test "at least one column stays visible" {
    [[ "$HTML_CONTENT" == *'keepsOne'* ]]
}

@test "columns panel labels are in English" {
    [[ "$HTML_CONTENT" == *'Show columns'* ]]
}

# ── structure ─────────────────────────────────────

@test "has search input" {
    [[ "$HTML_CONTENT" == *'id="search"'* ]]
}

@test "search placeholder is English" {
    [[ "$HTML_CONTENT" == *'placeholder="Filter providers…"'* ]]
}

@test "has detected group" {
    [[ "$HTML_CONTENT" == *'data-group="detected"'* ]]
}

@test "detected cards container is empty by default" {
    [[ "$HTML_CONTENT" == *'id="detected-cards"'* ]]
}

@test "has detected-empty hint" {
    [[ "$HTML_CONTENT" == *'id="detected-empty"'* ]]
}

@test "summary filters to detected providers only" {
    [[ "$HTML_CONTENT" == *"liveIds"* ]]
}

@test "cards are reorganized by detection" {
    [[ "$HTML_CONTENT" == *"organizeCards"* ]]
}

@test "has extra group" {
    [[ "$HTML_CONTENT" == *'data-group="extra"'* ]]
}

@test "extra group is a collapsible toggle" {
    [[ "$HTML_CONTENT" == *'id="extra-toggle"'* ]]
    [[ "$HTML_CONTENT" == *'role="button"'* ]]
    [[ "$HTML_CONTENT" == *'aria-expanded="false"'* ]]
}

@test "extra cards start collapsed" {
    [[ "$HTML_CONTENT" == *'id="extra-cards"'* ]]
    [[ "$HTML_CONTENT" == *'class="cards collapsed"'* ]]
}

@test "has chevron indicator" {
    [[ "$HTML_CONTENT" == *'class="chevron"'* ]]
}

@test "collapsed group excluded from search count" {
    [[ "$HTML_CONTENT" == *'groupCollapsed'* ]]
}

@test "has empty-state element" {
    [[ "$HTML_CONTENT" == *'id="empty"'* ]]
}

@test "empty state text is English" {
    [[ "$HTML_CONTENT" == *"Nothing matches that filter"* ]]
}

# ── cards with provider IDs ──────────────────────

@test "DeepSeek card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="deepseek"'* ]]
}

@test "anthropic is purged from the dashboard" {
    run grep -E 'data-provider="anthropic"|ANTHROPIC_API_KEY|console.anthropic.com' "$HTML"
    [ "$status" -eq 1 ]
}

@test "spend table filters purged providers" {
    [[ "$HTML_CONTENT" == *"name.indexOf('claude') !== 0"* ]]
    [[ "$HTML_CONTENT" == *"(m.provider || '') !== 'anthropic'"* ]]
}

@test "OpenAI card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="openai"'* ]]
}

@test "Groq card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="groq"'* ]]
}

@test "Mistral card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="mistral"'* ]]
}

@test "Moonshot card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="moonshot"'* ]]
}

@test "HuggingFace card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="huggingface"'* ]]
}

@test "Fireworks card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="fireworks"'* ]]
}

# ── buttons ───────────────────────────────────────

@test "all external links open in new tab" {
    local count_links=$(grep -c '<a class="btn' "$HTML")
    local count_target=$(grep -c 'target="_blank"' "$HTML")
    [ "$count_links" -eq "$count_target" ]
}

@test "buttons say Open console or Open local" {
    run grep -oP '>Open (console|local)<' "$HTML"
    [ "$status" -eq 0 ]
    [ "${#lines[@]}" -ge 4 ]
}

# ── footer ────────────────────────────────────────

@test "footer says Amsterdam Console" {
    [[ "$HTML_CONTENT" == *"Amsterdam Console"* ]]
}

@test "footer contains the amsterdam sonnet" {
    [[ "$HTML_CONTENT" == *'<details class="sonnet">'* ]]
    [[ "$HTML_CONTENT" == *"Read the Amsterdam sonnet"* ]]
    [[ "$HTML_CONTENT" == *"the dam holds fast what you most need to know"* ]]
}

# ── script ────────────────────────────────────────

@test "JavaScript search handler exists" {
    [[ "$HTML_CONTENT" == *'addEventListener("input"'* ]]
}

@test "JavaScript uses querySelectorAll for cards" {
    [[ "$HTML_CONTENT" == *'querySelectorAll(".card")'* ]]
}
