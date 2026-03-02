# @amadeni/convex-e2e

A config-driven end-to-end test runner for [Convex](https://convex.dev) projects.

The package provides the **engine** -- test runner, auth manager, assertions, reporting, and local backend orchestration. Your project provides the **content** -- roles, seed data, Convex support functions, and test suites -- via a typed config object.

## Install

```bash
npm install @amadeni/convex-e2e
# or
pnpm add @amadeni/convex-e2e
```

`convex` is a peer dependency and must be installed in your project.

## Overview

```
┌─────────────────────────────────────────────────────┐
│  Your Project                                       │
│                                                     │
│  e2e.config.ts         ← defineConfig({ ... })      │
│  e2e.test.ts           ← entry point: run(config)   │
│  e2e/suites/*.ts       ← your test suites           │
│                                                     │
│  convex/                                            │
│    testAuth.ts         ← createTestSession (JWT)    │
│    testSupport.ts      ← seed, clear, inspect fns   │
│    http.ts             ← OIDC discovery for auth     │
│    auth.config.ts      ← auth provider config        │
│                                                     │
│  run-e2e.sh            ← local backend wrapper       │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Create a config

```typescript
// e2e.config.ts
import { defineConfig } from '@amadeni/convex-e2e';
import { suites } from './e2e/suites';

type Role = 'admin' | 'editor';

export const config = defineConfig<Role>({
  projectName: 'My App',
  roles: {
    admin: 'admin@test.local',
    editor: 'editor@test.local',
  },
  defaultRole: 'admin',
  convexFunctions: {
    createSession: 'testAuth:createTestSession',
    seedBase: 'testSupport:seedBase',
    seedAll: 'testSupport:seedAll',
    clearAll: 'testSupport:clearAll',
    getSeedIdMap: 'testSupport:getSeedIdMap',
    deleteTracked: 'testSupport:deleteTracked',
    listRecords: 'testSupport:listRecords',
  },
  loadSuites: () => suites,
});
```

### 2. Create an entry point

```typescript
// e2e.test.ts
import { run } from '@amadeni/convex-e2e';
import { config } from './e2e.config';

run(config);
```

### 3. Write a test suite

```typescript
// e2e/suites/index.ts
import {
  assertDefined,
  assertMinLength,
  type TestSuite,
} from '@amadeni/convex-e2e';
import { api } from '../convex/_generated/api';

type Role = 'admin' | 'editor';

const itemsSuite: TestSuite<Role> = {
  name: 'items',
  tests: [
    {
      name: 'seed data exists',
      run: async (ctx) => {
        const items = await ctx.client.query(api.items.list);
        assertDefined(items);
        assertMinLength(items, 1);
      },
    },
    {
      name: 'can create as editor',
      role: 'editor',
      run: async (ctx) => {
        const id = await ctx.client.mutation(api.items.create, {
          title: 'Test',
        });
        assertDefined(id);
        ctx.track('items', id);
      },
    },
  ],
};

export const suites: TestSuite<Role>[] = [itemsSuite];
```

### 4. Create a local backend wrapper

```bash
#!/usr/bin/env bash
# run-e2e.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

export E2E_PROJECT_ROOT="$SCRIPT_DIR"
export E2E_TEST_COMMAND="npx tsx e2e.test.ts run --format=human"
export E2E_KEYGEN_SCRIPT="node_modules/@amadeni/convex-e2e/scripts/generate-keys.ts"

exec bash node_modules/@amadeni/convex-e2e/scripts/local-backend.sh
```

### 5. Add scripts to package.json

```json
{
  "scripts": {
    "test:e2e": "bash run-e2e.sh",
    "test:e2e:dev": "npx tsx e2e.test.ts run --format=human"
  }
}
```

### 6. Add to .gitignore

```gitignore
.local-backend/
convex_local_storage/
convex_local_backend.sqlite3
.env.e2e
.env.local.backup
test-private.pem
test-jwks.json
```

---

## What You Need to Implement in Convex

The test runner calls 7 Convex functions by path. You implement them in your `convex/` directory.

### Schema requirement

Your schema must include an `appSettings` table for storing the seed ID map:

```typescript
// convex/schema.ts (add to your existing schema)
appSettings: defineTable({
  key: v.string(),
  value: v.string(),
}).index('by_key', ['key']),
```

### Function reference

| Function | Type | Signature | Purpose |
|---|---|---|---|
| `createTestSession` | `internalAction` | `(email: string) => { userId, token }` | Signs a JWT for a test user |
| `seedBase` | `internalAction` | `() => Record<string, string>` | Seeds minimal data, returns ID map |
| `seedAll` | `internalAction` | `() => Record<string, string>` | Seeds all fixture data |
| `clearAll` | `internalAction` | `() => void` | Deletes all test data |
| `getSeedIdMap` | `internalQuery` | `() => Record<string, string>` | Reads the stored ID map |
| `deleteTracked` | `internalMutation` | `(ids: {table, id}[]) => void` | Deletes tracked test entities |
| `listRecords` | `internalQuery` | `(table, limit?) => Document[]` | Lists records (for `inspect` command) |

### Auth setup (for local backend)

The local backend needs to validate JWTs. This requires:

1. An HTTP route serving OIDC discovery + JWKS (so the backend can validate tokens)
2. An `auth.config.ts` pointing to the site URL
3. A `createTestSession` action that signs JWTs with the test private key

See the [fixtures/minimal/](fixtures/minimal/) directory for a complete working example.

---

## AI Setup Prompt

If you use an AI coding assistant, run this prompt in your project to have it scaffold the required Convex functions:

````
I am using the @amadeni/convex-e2e package for end-to-end testing.

Look at my convex/schema.ts to understand my tables. Then look at the reference
implementation in node_modules/@amadeni/convex-e2e/fixtures/minimal/convex/ to
understand the required function signatures and patterns.

Create the following files in my convex/ directory:

1. **convex/testAuth.ts** (`"use node"`) - `createTestSession` internalAction
   (signs an RS256 JWT using Node crypto and `JWT_PRIVATE_KEY` env var) and
   `getJwks` internalAction (returns `process.env.JWKS`).

2. **convex/testSupport.ts** - `seedBase`, `seedAll`, `clearAll` internalActions;
   `getSeedIdMap`, `listRecords` internalQueries; `deleteTracked` internalMutation.
   Seed data should cover my actual tables with realistic test records.
   Use `_symId` fields (e.g. `"@@user1"`) for cross-table ID references.

3. **convex/http.ts** - OIDC discovery routes (`/.well-known/openid-configuration`
   and `/jwks.json`) so the local backend can validate JWTs.

4. **convex/auth.config.ts** - Provider config pointing to `http://127.0.0.1:3211`.

5. Add an `appSettings` table to my schema if not already present (needed for the
   seed ID map).

Also create e2e.config.ts, e2e.test.ts, a test suite file, and run-e2e.sh at the
project root. Follow the Quick Start section of the package README for these.
````

---

## Working Example

The [fixtures/minimal/](fixtures/minimal/) directory is a complete, runnable example project. It demonstrates:

- Schema with 2 tables (`items` + `appSettings`)
- All 7 required Convex functions
- JWT auth with OIDC discovery
- Config, test suite, and entry point
- Local backend wrapper script

---

## Config Reference

```typescript
interface ConvexE2EConfig<R extends string> {
  projectName: string;
  projectRoot?: string;        // defaults to process.cwd()
  roles: Record<R, string>;   // role name -> test user email
  defaultRole: R;
  convexFunctions: {
    createSession: string;     // "module:functionName" format
    seedBase: string;
    seedAll: string;
    clearAll: string;
    getSeedIdMap: string;
    deleteTracked: string;
    listRecords: string;
  };
  loadSuites: () => TestSuite<R>[];
  envFiles?: string[];         // defaults to ['.env.local', '.env', '.env.test']
}
```

## Test Context

Each test receives a `TestContext` with:

```typescript
interface TestContext<R extends string> {
  client: ConvexHttpClient;           // authenticated for the test's role
  auth: TestAuthManager<R>;           // token management
  userId: string;                     // current role's user ID
  role: R;                            // current role
  seedData: Record<string, SeedId>;   // symbolic ID map (e.g. seedData['@@user1'])
  track(table: string, id: string): void;  // register for cleanup
  asAdmin<T>(fn: (client) => Promise<T>): Promise<T>;
  actAs<T>(role: R, fn: (client) => Promise<T>): Promise<T>;
  log(msg: string): void;            // verbose-only output
}
```

## Assertions

```typescript
import {
  assert,              // re-export of node:assert/strict
  assertDefined,       // value is not null/undefined
  assertMinLength,     // array has at least N items
  assertThrows,        // async function throws (optional pattern match)
  assertForbidden,     // function throws a permission error
  assertNotPermissionFailure,  // function succeeds or fails for non-permission reasons
} from '@amadeni/convex-e2e';
```

## CLI Commands

```
npx tsx e2e.test.ts <command> [options]

Commands:
  run [filter]       Run tests (filter by suite name prefix)
  seed               Load all seed data
  clear              Clear all test data
  reset              Clear + seed
  list               List suites and tests as JSON
  inspect <table>    Show records in a table

Options:
  --format=json|human  Output format (default: human)
  --json               Shorthand for --format=json
  --verbose            Show detailed output
  --bail               Stop on first failure
  --timeout=<ms>       Per-test timeout (default: 30000)
  --deployment=<url>   Override Convex URL
```

## Local Backend Script

The included `scripts/local-backend.sh` orchestrates a fully isolated test environment:

1. Downloads `convex-local-backend` (cached in `.local-backend/`)
2. Starts the backend on a local port
3. Generates a JWT key pair for test auth
4. Deploys your Convex functions
5. Sets `JWT_PRIVATE_KEY` and `JWKS` environment variables
6. Runs your test command
7. Cleans up on exit (backend process, temp files, restores `.env.local`)

Controlled via environment variables set in your wrapper script:

| Variable | Required | Description |
|---|---|---|
| `E2E_PROJECT_ROOT` | yes | Absolute path to project root |
| `E2E_TEST_COMMAND` | yes | Command to run tests |
| `E2E_KEYGEN_SCRIPT` | yes | Path to key generation script (relative to project root) |
| `E2E_JWT_ENV_VARS` | no | Space-separated `KEY=file` pairs (default: `JWT_PRIVATE_KEY=test-private.pem JWKS=test-jwks.json`) |
| `CONVEX_LOCAL_PORT` | no | Backend port (default: `3210`) |

## Convex Helpers

The `convex-helpers/` directory contains reference implementations for the Convex-side functions. Since Convex functions must live inside your project's `convex/` directory, these are meant to be copied and adapted.

- `convex-helpers/seed.ts` -- `resolveRefs()` for symbolic ID resolution + templates for seed/clear functions
- `convex-helpers/inspect.ts` -- templates for `getSeedIdMap`, `listRecords`, etc.

## License

MIT
