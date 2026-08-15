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

# ── cards with provider IDs ──────────────────────

@test "DeepSeek card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="deepseek"'* ]]
}

@test "Anthropic card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="anthropic"'* ]]
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

# ── amsterdam joke ────────────────────────────────

@test "dam metaphor is present" {
    [[ "$HTML_CONTENT" == *"HTML dam"* ]]
}

# ── script ────────────────────────────────────────

@test "JavaScript search handler exists" {
    [[ "$HTML_CONTENT" == *'addEventListener("input"'* ]]
}

@test "JavaScript uses querySelectorAll for cards" {
    [[ "$HTML_CONTENT" == *'querySelectorAll(".card")'* ]]
}
