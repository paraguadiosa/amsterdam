#!/usr/bin/env bats

setup() {
    REPO_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
    HELPER="$REPO_DIR/scripts/amster-docker"

    # Stub docker: log args and print nothing.
    BIN_DIR="$BATS_TEST_TMPDIR/bin"
    mkdir -p "$BIN_DIR"
    cat > "$BIN_DIR/docker" <<'EOF'
#!/bin/sh
echo "$@" >> "$DOCKER_LOG"
EOF
    chmod +x "$BIN_DIR/docker"
    export DOCKER_LOG="$BATS_TEST_TMPDIR/docker.log"
    export PATH="$BIN_DIR:$PATH"

    # A valid env file for run/up tests.
    ENV_FILE="$BATS_TEST_TMPDIR/.env"
    echo "DEEPSEEK_API_KEY=sk-test" > "$ENV_FILE"
}

# ── usage ────────────────────────────────────────

@test "no arguments prints usage and exits 0" {
    run "$HELPER"
    [ "$status" -eq 0 ]
    [[ "$output" == *"usage: amster-docker"* ]]
}

@test "help prints usage" {
    run "$HELPER" help
    [ "$status" -eq 0 ]
    [[ "$output" == *"build"* ]]
    [[ "$output" == *"run"* ]]
    [[ "$output" == *"up"* ]]
    [[ "$output" == *"stop"* ]]
}

@test "unknown command exits 2" {
    run "$HELPER" whatever
    [ "$status" -eq 2 ]
    [[ "$output" == *"usage: amster-docker"* ]]
}

# ── build ────────────────────────────────────────

@test "build runs docker build" {
    run "$HELPER" build
    [ "$status" -eq 0 ]
    [[ "$(cat "$DOCKER_LOG")" == "build -t amsterdam ." ]]
}

@test "build respects AMSTERDAM_IMAGE" {
    export AMSTERDAM_IMAGE="my-amsterdam"
    run "$HELPER" build
    [[ "$(cat "$DOCKER_LOG")" == "build -t my-amsterdam ." ]]
}

# ── run ──────────────────────────────────────────

@test "run fails when env file is missing" {
    export AMSTERDAM_ENV_FILE="/nonexistent/.env"
    run "$HELPER" run
    [ "$status" -eq 1 ]
    [[ "$output" == *"Error"* ]]
    [[ "$output" == *"env file not found"* ]]
}

@test "run mounts env file and maps port" {
    export AMSTERDAM_ENV_FILE="$ENV_FILE"
    run "$HELPER" run
    [ "$status" -eq 0 ]
    local log="$(cat "$DOCKER_LOG")"
    [[ "$log" == *"run --rm -it"* ]]
    [[ "$log" == *"-p 3131:3131"* ]]
    [[ "$log" == *"-v $ENV_FILE:/app/.env:ro"* ]]
    [[ "$log" == *"--name amsterdam"* ]]
}

@test "run respects AMSTERDAM_PORT" {
    export AMSTERDAM_ENV_FILE="$ENV_FILE"
    export AMSTERDAM_PORT=4141
    run "$HELPER" run
    [[ "$(cat "$DOCKER_LOG")" == *"-p 4141:3131"* ]]
}

# ── up ───────────────────────────────────────────

@test "up runs in background and prints URL" {
    export AMSTERDAM_ENV_FILE="$ENV_FILE"
    run "$HELPER" up
    [ "$status" -eq 0 ]
    [[ "$(cat "$DOCKER_LOG")" == *"run --rm -d"* ]]
    [[ "$output" == "http://localhost:3131" ]]
}

@test "up prints URL with custom port" {
    export AMSTERDAM_ENV_FILE="$ENV_FILE"
    export AMSTERDAM_PORT=5151
    run "$HELPER" up
    [[ "$output" == "http://localhost:5151" ]]
}

# ── stop ─────────────────────────────────────────

@test "stop runs docker stop" {
    run "$HELPER" stop
    [ "$status" -eq 0 ]
    [[ "$(cat "$DOCKER_LOG")" == "stop amsterdam" ]]
}
