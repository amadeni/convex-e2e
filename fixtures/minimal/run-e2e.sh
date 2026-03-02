#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export E2E_PROJECT_ROOT="$SCRIPT_DIR"
export E2E_TEST_COMMAND="npx tsx e2e.test.ts run --format=human"
export E2E_KEYGEN_SCRIPT="../../scripts/generate-keys.ts"

exec bash "$REPO_ROOT/scripts/local-backend.sh"
