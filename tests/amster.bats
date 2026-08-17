#!/usr/bin/env bats

TEST_PORT=3199

setup() {
    REPO_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
    AMSTER="$REPO_DIR/scripts/amster"
    HTML="$REPO_DIR/index.html"
    PID_FILE="$REPO_DIR/data/amsterdam.pid"

    export PORT="$TEST_PORT"

    # Isolate the daemon from real credentials (no .env, no hermes pool).
    export HOME="$BATS_TEST_TMPDIR/fake-home"
    mkdir -p "$HOME"

    # Stub the browser opener: log the target instead of launching one.
    OPEN_SH="$BATS_TEST_TMPDIR/open.sh"
    cat > "$OPEN_SH" <<'EOF'
#!/bin/sh
echo "open:$*" >> "$OPEN_LOG"
EOF
    chmod +x "$OPEN_SH"
    export AMSTERDAM_OPEN="$OPEN_SH"
    export OPEN_LOG="$BATS_TEST_TMPDIR/open.log"
    : > "$OPEN_LOG"
}

# bats runs teardown even on failure (its own EXIT trap), so the daemon
# never survives a test, passing or failing.
teardown() {
    "$AMSTER" stop >/dev/null 2>&1 || true
    PORT=3198 "$AMSTER" stop >/dev/null 2>&1 || true
    rm -f "$PID_FILE"
}

count_listeners() {
    if command -v lsof >/dev/null 2>&1; then
        lsof -t -i "TCP:$TEST_PORT" 2>/dev/null | wc -l | tr -d ' '
    else
        ss -ltn "sport = :$TEST_PORT" 2>/dev/null | grep -c LISTEN || true
    fi
}

# ── help / usage ──────────────────────────────────

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
    [[ "$output" == *"dump"* ]]
    [[ "$output" == *"serve"* ]]
    [[ "$output" == *"open"* ]]
    [[ "$output" == *"link"* ]]
    [[ "$output" == *"path"* ]]
    [[ "$output" == *"start"* ]]
    [[ "$output" == *"status"* ]]
    [[ "$output" == *"stop"* ]]
    [[ "$output" == *"help"* ]]
}

@test "usage shows URL line" {
    run "$AMSTER" help
    [[ "$output" == *"URL: file://"* ]]
}

# ── link ──────────────────────────────────────────

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

# ── path ──────────────────────────────────────────

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

# ── status / start / stop ─────────────────────────

@test "status on a free port reports stopped" {
    run "$AMSTER" status
    [ "$status" -eq 0 ]
    [[ "$output" == "stopped" ]]
}

@test "start launches a detached daemon" {
    run "$AMSTER" start
    [ "$status" -eq 0 ]
    [[ "$output" == *"up at http://localhost:$TEST_PORT"* ]]
    [ -f "$PID_FILE" ]
    local pid="$(cat "$PID_FILE")"
    [ -n "$pid" ]
    kill -0 "$pid" 2>/dev/null

    run "$AMSTER" status
    [ "$status" -eq 0 ]
    [[ "$output" == *"running"* ]]
    [[ "$output" == *"http://localhost:$TEST_PORT"* ]]
    [[ "$output" == *"(pid $pid)"* ]]

    run curl --max-time 2 -s -o /dev/null -w '%{http_code}' "http://localhost:$TEST_PORT/api/billing"
    [ "$status" -eq 0 ]
    [[ "$output" == "200" ]]
}

@test "second start reports already running with the same pid" {
    "$AMSTER" start
    local pid1="$(cat "$PID_FILE")"

    run "$AMSTER" start
    [ "$status" -eq 0 ]
    [[ "$output" == *"already running"* ]]

    local pid2="$(cat "$PID_FILE")"
    [ "$pid2" == "$pid1" ]

    local listeners="$(count_listeners)"
    [ "$listeners" -eq 1 ]
}

@test "stop kills the daemon and status returns stopped" {
    "$AMSTER" start
    [ -f "$PID_FILE" ]

    run "$AMSTER" stop
    [ "$status" -eq 0 ]
    [[ "$output" == "stopped" ]]
    [ ! -f "$PID_FILE" ]

    run "$AMSTER" status
    [ "$status" -eq 0 ]
    [[ "$output" == "stopped" ]]
}

@test "stop is idempotent when nothing is running" {
    run "$AMSTER" stop
    [ "$status" -eq 0 ]
    [[ "$output" == "stopped" ]]
}

@test "stop without a pidfile hints at a manual daemon" {
    PORT=3198 node "$REPO_DIR/src/server.js" 3198 >/dev/null 2>&1 &
    local manual_pid=$!
    sleep 1

    run env PORT=3198 "$AMSTER" stop
    [ "$status" -eq 1 ]
    [[ "$output" == *"kill $manual_pid"* ]]

    kill "$manual_pid" 2>/dev/null || true
    wait "$manual_pid" 2>/dev/null || true
}

# ── open ──────────────────────────────────────────

@test "open opens the live URL when the daemon is running" {
    "$AMSTER" start
    run "$AMSTER" open
    [ "$status" -eq 0 ]
    [[ "$(cat "$OPEN_LOG")" == *"http://localhost:$TEST_PORT"* ]]
}

@test "open falls back to the static file when the daemon is stopped" {
    run "$AMSTER" open
    [ "$status" -eq 0 ]
    [[ "$(cat "$OPEN_LOG")" == "open:$HTML" ]]
}

@test "demo opens the live URL with ?demo when the daemon is running" {
    "$AMSTER" start
    run "$AMSTER" demo
    [ "$status" -eq 0 ]
    [[ "$(cat "$OPEN_LOG")" == "open:http://localhost:$TEST_PORT/?demo" ]]
}

@test "demo falls back to the static file with ?demo when stopped" {
    run "$AMSTER" demo
    [ "$status" -eq 0 ]
    [[ "$(cat "$OPEN_LOG")" == "open:$HTML?demo" ]]
}

@test "usage lists the demo command" {
    run "$AMSTER" help
    [[ "$output" == *"demo"* ]]
}

@test "open with missing HTML exits 1 with error" {
    local tmp="$HTML.bak"
    mv "$HTML" "$tmp"
    run "$AMSTER" open
    mv "$tmp" "$HTML"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Error"* ]]
    [[ "$output" == *"file not found"* ]]
}

# ── unknown command ───────────────────────────────

@test "unknown command prints usage to stderr and exits 2" {
    run "$AMSTER" floodgate
    [ "$status" -eq 2 ]
    [[ "$output" == *"usage: amster"* ]]
}

@test "another unknown command also exits 2" {
    run "$AMSTER" zzz
    [ "$status" -eq 2 ]
}

# ── relative path resolution ─────────────────────

@test "script resolves index.html relative to itself" {
    run bash -c "cd /tmp && '$AMSTER' path"
    [ "$status" -eq 0 ]
    [ -f "$output" ]
}

# ── no Spanish remnants ──────────────────────────

@test "script contains no Spanish text" {
    run grep -iE "uso:|comando|muestra|lanzador|argumento|encontro" "$AMSTER"
    [ "$status" -eq 1 ]
}
