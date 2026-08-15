#!/usr/bin/env bats

setup() {
    REPO_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
    AMSTERDAM="$REPO_DIR/scripts/amsterdam"
    INSTALL="$REPO_DIR/scripts/amsterdam-install"
    HTML="$REPO_DIR/index.html"

    # Stub docker: log args and print nothing.
    BIN_DIR="$BATS_TEST_TMPDIR/bin"
    mkdir -p "$BIN_DIR"
    cat > "$BIN_DIR/docker" <<'EOF'
#!/bin/sh
echo "$@" >> "$DOCKER_LOG"
EOF
    chmod +x "$BIN_DIR/docker"
    export DOCKER_LOG="$BATS_TEST_TMPDIR/docker.log"

    # Stub node: log args and exit (keeps serve from blocking).
    cat > "$BIN_DIR/node" <<'EOF'
#!/bin/sh
echo "$@" >> "$NODE_LOG"
EOF
    chmod +x "$BIN_DIR/node"
    export NODE_LOG="$BATS_TEST_TMPDIR/node.log"

    export PATH="$BIN_DIR:$PATH"

    ENV_FILE="$BATS_TEST_TMPDIR/.env"
    echo "DEEPSEEK_API_KEY=sk-test" > "$ENV_FILE"
    export AMSTERDAM_ENV_FILE="$ENV_FILE"
}

# ── default: host daemon ────────────────────────

@test "no arguments runs the host daemon" {
    run "$AMSTERDAM"
    [ "$status" -eq 0 ]
    [[ "$(cat "$NODE_LOG")" == *"src/server.js"* ]]
}

@test "serve runs the host daemon" {
    run "$AMSTERDAM" serve
    [ "$status" -eq 0 ]
    [[ "$(cat "$NODE_LOG")" == *"src/server.js"* ]]
}

# ── opt-in Docker ───────────────────────────────

@test "docker runs docker up in background and prints URL" {
    run "$AMSTERDAM" docker
    [ "$status" -eq 0 ]
    [[ "$(cat "$DOCKER_LOG")" == *"run --rm -d"* ]]
    [[ "$output" == "http://localhost:3131" ]]
}

@test "up runs docker up" {
    run "$AMSTERDAM" up
    [ "$status" -eq 0 ]
    [[ "$(cat "$DOCKER_LOG")" == *"run --rm -d"* ]]
}

@test "stop runs docker stop" {
    run "$AMSTERDAM" stop
    [ "$status" -eq 0 ]
    [[ "$(cat "$DOCKER_LOG")" == "stop amsterdam" ]]
}

@test "build runs docker build" {
    run "$AMSTERDAM" build
    [ "$status" -eq 0 ]
    [[ "$(cat "$DOCKER_LOG")" == "build -t amsterdam ." ]]
}

@test "run runs docker in the foreground" {
    run "$AMSTERDAM" run
    [ "$status" -eq 0 ]
    [[ "$(cat "$DOCKER_LOG")" == *"run --rm -it"* ]]
}

# ── passthrough to amster ───────────────────────

@test "help prints usage with all commands" {
    run "$AMSTERDAM" help
    [ "$status" -eq 0 ]
    [[ "$output" == *"usage: amsterdam"* ]]
    [[ "$output" == *"serve"* ]]
    [[ "$output" == *"docker"* ]]
    [[ "$output" == *"dump"* ]]
    [[ "$output" == *"open"* ]]
    [[ "$output" == *"stop"* ]]
    [[ "$output" == *"build"* ]]
}

@test "path passes through to amster" {
    run "$AMSTERDAM" path
    [ "$status" -eq 0 ]
    [ -f "$output" ]
    [[ "$output" == "$HTML" ]]
}

@test "link passes through to amster" {
    run "$AMSTERDAM" link
    [ "$status" -eq 0 ]
    [[ "$output" == "file://$HTML" ]]
}

@test "unknown command prints usage to stderr and exits 2" {
    run "$AMSTERDAM" whatever
    [ "$status" -eq 2 ]
    [[ "$output" == *"usage: amsterdam"* ]]
}

# ── symlink invocation ──────────────────────────

@test "resolves repo when invoked through a symlink" {
    ln -s "$AMSTERDAM" "$BIN_DIR/amsterdam"
    run bash -c "cd /tmp && PATH='$BIN_DIR:$PATH' amsterdam path"
    [ "$status" -eq 0 ]
    [ -f "$output" ]
    [[ "$output" == "$HTML" ]]
}

@test "resolves repo for docker commands through a symlink" {
    ln -s "$AMSTERDAM" "$BIN_DIR/amsterdam"
    run bash -c "cd /tmp && PATH='$BIN_DIR:$PATH' amsterdam build"
    [ "$status" -eq 0 ]
    [[ "$(cat "$DOCKER_LOG")" == "build -t amsterdam ." ]]
}

# ── install ─────────────────────────────────────

@test "install creates symlinks in AMSTERDAM_BIN_DIR" {
    export AMSTERDAM_BIN_DIR="$BATS_TEST_TMPDIR/bin-install"
    run "$INSTALL"
    [ "$status" -eq 0 ]
    [ -L "$AMSTERDAM_BIN_DIR/amsterdam" ]
    [ -L "$AMSTERDAM_BIN_DIR/amster" ]
    [ -L "$AMSTERDAM_BIN_DIR/amster-docker" ]
}
