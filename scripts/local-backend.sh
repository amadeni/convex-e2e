#!/usr/bin/env bash
#
# Generic local Convex backend orchestrator for e2e tests.
#
# Required env vars (set by the project wrapper):
#   E2E_PROJECT_ROOT     - absolute path to the project root
#   E2E_TEST_COMMAND     - command to run the tests (e.g. "npx tsx cli-test/bin/test.ts run --format=human")
#   E2E_KEYGEN_SCRIPT    - path to the JWT key generation script (relative to project root)
#
# Optional env vars:
#   CONVEX_LOCAL_PORT    - port for the local backend (default: 3210)
#   E2E_JWT_ENV_VARS     - space-separated list of "KEY=file" pairs for Convex env vars
#                          (default: "JWT_PRIVATE_KEY=test-private.pem JWKS=test-jwks.json")
#
set -euo pipefail

PROJECT_ROOT="${E2E_PROJECT_ROOT:?E2E_PROJECT_ROOT must be set}"
TEST_COMMAND="${E2E_TEST_COMMAND:?E2E_TEST_COMMAND must be set}"
KEYGEN_SCRIPT="${E2E_KEYGEN_SCRIPT:?E2E_KEYGEN_SCRIPT must be set}"

CACHE_DIR="$PROJECT_ROOT/.local-backend"
BACKEND_PORT="${CONVEX_LOCAL_PORT:-3210}"
BACKEND_URL="http://127.0.0.1:$BACKEND_PORT"
ADMIN_KEY="0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd"
ENV_FILE="$PROJECT_ROOT/.env.e2e"
ENV_LOCAL="$PROJECT_ROOT/.env.local"
ENV_LOCAL_BACKUP="$PROJECT_ROOT/.env.local.backup"
BACKEND_PID=""

JWT_ENV_VARS="${E2E_JWT_ENV_VARS:-JWT_PRIVATE_KEY=test-private.pem JWKS=test-jwks.json}"
CONVEX_INLINE_ENV="${E2E_CONVEX_ENV:-}"

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Stopping local Convex backend (pid $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  rm -f "$ENV_FILE"
  rm -rf "$PROJECT_ROOT/convex_local_storage"
  rm -f "$PROJECT_ROOT/convex_local_backend.sqlite3"
  # Clean up generated key files
  for pair in $JWT_ENV_VARS; do
    local file="${pair#*=}"
    rm -f "$PROJECT_ROOT/$file"
  done
  if [ -f "$ENV_LOCAL_BACKUP" ]; then
    mv "$ENV_LOCAL_BACKUP" "$ENV_LOCAL"
    echo "Restored .env.local"
  fi
}
trap cleanup EXIT INT TERM

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin)
      case "$arch" in
        arm64)  echo "aarch64-apple-darwin" ;;
        x86_64) echo "x86_64-apple-darwin" ;;
        *)      echo "Unsupported macOS architecture: $arch" >&2; exit 1 ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64)  echo "x86_64-unknown-linux-gnu" ;;
        aarch64) echo "aarch64-unknown-linux-gnu" ;;
        *)       echo "Unsupported Linux architecture: $arch" >&2; exit 1 ;;
      esac
      ;;
    *)
      echo "Unsupported OS: $os" >&2; exit 1
      ;;
  esac
}

download_backend() {
  local platform="$1"
  local binary="$CACHE_DIR/convex-local-backend"

  if [ -x "$binary" ]; then
    echo "Using cached backend binary."
    return
  fi

  mkdir -p "$CACHE_DIR"
  local zip_name="convex-local-backend-${platform}.zip"
  local url="https://github.com/get-convex/convex-backend/releases/latest/download/${zip_name}"

  echo "Downloading $zip_name..."
  curl -fsSL -o "$CACHE_DIR/$zip_name" "$url"
  unzip -o "$CACHE_DIR/$zip_name" -d "$CACHE_DIR"
  chmod +x "$binary"
  rm -f "$CACHE_DIR/$zip_name"
  echo "Backend binary ready."
}

start_backend() {
  local binary="$CACHE_DIR/convex-local-backend"
  echo "Starting local Convex backend on port $BACKEND_PORT..."
  "$binary" --port "$BACKEND_PORT" > "$CACHE_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!

  local attempts=30
  for i in $(seq 1 $attempts); do
    if curl -s "$BACKEND_URL/version" > /dev/null 2>&1; then
      echo "Backend is ready (pid $BACKEND_PID)."
      return
    fi
    sleep 1
  done

  echo "Backend failed to start within ${attempts}s. Logs:" >&2
  cat "$CACHE_DIR/backend.log" >&2
  exit 1
}

backup_env_local() {
  if [ -f "$ENV_LOCAL" ]; then
    cp "$ENV_LOCAL" "$ENV_LOCAL_BACKUP"
    echo "Backed up .env.local"
  fi
}

write_env_file() {
  cat > "$ENV_FILE" <<EOF
CONVEX_SELF_HOSTED_URL=$BACKEND_URL
CONVEX_SELF_HOSTED_ADMIN_KEY=$ADMIN_KEY
EOF
  echo "Wrote $ENV_FILE"
}

generate_keys() {
  echo "Generating JWT test keys..."
  if [[ "$KEYGEN_SCRIPT" = /* ]]; then
    npx tsx "$KEYGEN_SCRIPT"
  else
    npx tsx "$PROJECT_ROOT/$KEYGEN_SCRIPT"
  fi
}

deploy_functions() {
  echo "Deploying Convex functions to local backend..."
  npx convex dev --once --env-file "$ENV_FILE"
}

set_convex_env_vars() {
  echo "Setting Convex environment variables..."
  for pair in $JWT_ENV_VARS; do
    local key="${pair%%=*}"
    local file="${pair#*=}"
    npx convex env set --env-file "$ENV_FILE" -- \
      "$key" "$(cat "$PROJECT_ROOT/$file")"
  done
  for pair in $CONVEX_INLINE_ENV; do
    local key="${pair%%=*}"
    local value="${pair#*=}"
    npx convex env set --env-file "$ENV_FILE" -- "$key" "$value"
  done
}

run_tests() {
  echo ""
  echo "Running e2e tests against local backend..."
  echo "================================================"
  CONVEX_ENV_FILE="$ENV_FILE" \
  CONVEX_URL="$BACKEND_URL" \
  NEXT_PUBLIC_CONVEX_URL="$BACKEND_URL" \
    eval "$TEST_COMMAND" "$@"
}

main() {
  cd "$PROJECT_ROOT"

  local platform
  platform="$(detect_platform)"

  download_backend "$platform"
  start_backend
  backup_env_local
  write_env_file
  generate_keys
  deploy_functions
  set_convex_env_vars
  run_tests "$@"
}

main "$@"
