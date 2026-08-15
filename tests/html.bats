#!/usr/bin/env bats

setup() {
    REPO_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
    HTML="$REPO_DIR/index.html"
    HTML_CONTENT="$(cat "$HTML")"
}

# ── language ──────────────────────────────────────────────────

@test "html lang is en" {
    [[ "$HTML_CONTENT" == *'lang="en"'* ]]
}

@test "title is in English" {
    [[ "$HTML_CONTENT" == *"<title>LLM Console Launcher</title>"* ]]
}

# ── no Spanish remnants ──────────────────────────────────────

@test "no Spanish text in HTML" {
    run grep -iE "consolas de|facturación|filtrar proveedores|abrir consola|se encontró|nunca pegues|lanzador" "$HTML"
    [ "$status" -eq 1 ]
}

# ── structure ─────────────────────────────────────────────────

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

@test "has empty-state element" {
    [[ "$HTML_CONTENT" == *'id="empty"'* ]]
}

@test "empty state text is English" {
    [[ "$HTML_CONTENT" == *"Nothing matches that filter"* ]]
}

# ── cards ─────────────────────────────────────────────────────

@test "has DeepSeek card" {
    [[ "$HTML_CONTENT" == *'data-name="deepseek'* ]]
}

@test "has Anthropic card" {
    [[ "$HTML_CONTENT" == *'data-name="anthropic'* ]]
}

@test "has OpenAI card" {
    [[ "$HTML_CONTENT" == *'data-name="openai'* ]]
}

@test "has Groq card" {
    [[ "$HTML_CONTENT" == *'data-name="groq"'* ]]
}

@test "has Mistral card" {
    [[ "$HTML_CONTENT" == *'data-name="mistral'* ]]
}

@test "has local llama card" {
    [[ "$HTML_CONTENT" == *'data-name="local llama'* ]]
}

@test "has Kimi / Moonshot card" {
    [[ "$HTML_CONTENT" == *'data-name="kimi moonshot'* ]]
}

# ── buttons ───────────────────────────────────────────────────

@test "all external links open in new tab" {
    local count_links
    count_links=$(grep -c 'class="btn' "$HTML")
    local count_target
    count_target=$(grep -c 'target="_blank"' "$HTML")
    [ "$count_links" -eq "$count_target" ]
}

@test "buttons say Open console or Open local" {
    run grep -oP '>Open (console|local)<' "$HTML"
    [ "$status" -eq 0 ]
    [ "${#lines[@]}" -ge 4 ]
}

# ── warning ───────────────────────────────────────────────────

@test "warning text is English" {
    [[ "$HTML_CONTENT" == *"Never paste API keys here"* ]]
}

# ── footer ────────────────────────────────────────────────────

@test "footer is English" {
    [[ "$HTML_CONTENT" == *"Offline launcher"* ]]
}

# ── amsterdam joke ────────────────────────────────────────────

@test "amsterdam joke is present" {
    [[ "$HTML_CONTENT" == *"Amster-dam"* ]]
}

@test "dam metaphor is present" {
    [[ "$HTML_CONTENT" == *"HTML dam"* ]]
}

# ── script ────────────────────────────────────────────────────

@test "JavaScript search handler exists" {
    [[ "$HTML_CONTENT" == *'addEventListener("input"'* ]]
}

@test "JavaScript uses querySelectorAll for cards" {
    [[ "$HTML_CONTENT" == *'querySelectorAll(".card")'* ]]
}
