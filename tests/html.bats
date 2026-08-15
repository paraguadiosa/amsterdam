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

@test "has populateSummary function" {
    [[ "$HTML_CONTENT" == *"populateSummary"* ]]
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

@test "Anthropic card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="anthropic"'* ]]
}

@test "OpenAI card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="openai"'* ]]
}

@test "OpenRouter card has data-provider" {
    [[ "$HTML_CONTENT" == *'data-provider="openrouter"'* ]]
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
