#!/usr/bin/env bats

setup() {
    REPO_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
    AMSTER="$REPO_DIR/scripts/amster"
    HTML="$REPO_DIR/index.html"
}

# ── help / usage ──────────────────────────────────────────────

@test "no arguments prints usage and exits 0" {
    run "$AMSTER"
    [ "$status" -eq 0 ]
    [[ "$output" == *"usage: amster"* ]]
}

@test "help prints usage and exits 0" {
    run "$AMSTER" help
    [ "$status" -eq 0 ]
    [[ "$output" == *"usage: amster"* ]]
}

@test "-h prints usage and exits 0" {
    run "$AMSTER" -h
    [ "$status" -eq 0 ]
    [[ "$output" == *"usage: amster"* ]]
}

@test "--help prints usage and exits 0" {
    run "$AMSTER" --help
    [ "$status" -eq 0 ]
    [[ "$output" == *"usage: amster"* ]]
}

@test "usage lists all commands" {
    run "$AMSTER" help
    [[ "$output" == *"link"* ]]
    [[ "$output" == *"path"* ]]
    [[ "$output" == *"dump"* ]]
    [[ "$output" == *"open"* ]]
    [[ "$output" == *"help"* ]]
}

@test "usage shows URL line" {
    run "$AMSTER" help
    [[ "$output" == *"URL: file://"* ]]
}

# ── link ──────────────────────────────────────────────────────

@test "link prints file:// URL" {
    run "$AMSTER" link
    [ "$status" -eq 0 ]
    [[ "$output" == "file://"* ]]
    [[ "$output" == *"index.html" ]]
}

@test "link URL points to an existing file" {
    run "$AMSTER" link
    local file_path="${output#file://}"
    [ -f "$file_path" ]
}

# ── path ──────────────────────────────────────────────────────

@test "path prints absolute path" {
    run "$AMSTER" path
    [ "$status" -eq 0 ]
    [[ "$output" == /* ]]
    [[ "$output" == *"index.html" ]]
}

@test "path points to existing file" {
    run "$AMSTER" path
    [ -f "$output" ]
}

# ── dump / open ───────────────────────────────────────────────

@test "dump with missing HTML exits 1 with error" {
    # Temporarily rename the HTML to simulate a missing file
    local tmp="$HTML.bak"
    mv "$HTML" "$tmp"
    run "$AMSTER" dump
    mv "$tmp" "$HTML"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Error"* ]]
    [[ "$output" == *"file not found"* ]]
}

@test "open with missing HTML exits 1 with error" {
    local tmp="$HTML.bak"
    mv "$HTML" "$tmp"
    run "$AMSTER" open
    mv "$tmp" "$HTML"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Error"* ]]
}

# ── unknown command ───────────────────────────────────────────

@test "unknown command prints usage to stderr and exits 2" {
    run "$AMSTER" floodgate
    [ "$status" -eq 2 ]
    [[ "$output" == *"usage: amster"* ]]
}

@test "another unknown command also exits 2" {
    run "$AMSTER" zzz
    [ "$status" -eq 2 ]
}

# ── relative path resolution ─────────────────────────────────

@test "script resolves index.html relative to itself" {
    # Run from a different directory
    run bash -c "cd /tmp && '$AMSTER' path"
    [ "$status" -eq 0 ]
    [ -f "$output" ]
}

# ── no Spanish remnants ──────────────────────────────────────

@test "script contains no Spanish text" {
    run grep -iE "uso:|comando|muestra|lanzador|argumento|encontro" "$AMSTER"
    [ "$status" -eq 1 ]
}
