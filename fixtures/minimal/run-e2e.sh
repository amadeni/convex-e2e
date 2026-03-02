#!/usr/bin/env bash
set -euo pipefail

export E2E_PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
export E2E_TEST_COMMAND="npx tsx e2e.test.ts run --format=human"
export E2E_KEYGEN_SCRIPT="../../scripts/generate-keys.ts"

exec bash ../../scripts/local-backend.sh
