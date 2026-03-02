# convex-e2e

A reusable, config-driven end-to-end test runner for Convex + Next.js projects.

It provides the **engine** (test runner, auth manager, assertions, reporting, local backend orchestration). Your project provides the **content** (roles, seed data, tests, Convex support functions) via a config object.

## Quick Start

### 1. Copy `convex-e2e/` into your project root

```
my-project/
  convex-e2e/        <-- this module
  convex/            <-- your Convex functions
  cli-test/          <-- your project-specific test code
    bin/entry.ts
    config.ts
    lib/types.ts     <-- re-export shims (optional but recommended)
    tests/
  package.json
```

### 2. Create a project config

Create `cli-test/config.ts`:

```typescript
import { defineConfig } from '../convex-e2e/src/index';
import { loadAllSuites } from './tests';

const config = defineConfig({
  projectName: 'My Project',
  roles: {
    admin: 'admin@my-project.test',
    editor: 'editor@my-project.test',
    viewer: 'viewer@my-project.test',
  },
  defaultRole: 'admin',
  convexFunctions: {
    createSession: 'testSupport/auth:createTestSession',
    seedBase: 'testData/seed:seedBase',
    seedAll: 'testData/seed:seedAll',
    clearAll: 'testData/seed:clearAll',
    getSeedIdMap: 'testSupport/inspect:getSeedIdMap',
    deleteTracked: 'testSupport/cleanup:deleteDocuments',
    listRecords: 'testSupport/inspect:listRecords',
  },
  loadSuites: loadAllSuites,
});

export default config;
```

### 3. Create a CLI entry point

Create `cli-test/bin/my-test.ts`:

```typescript
#!/usr/bin/env node
import { run } from '../../convex-e2e/src/cli';
import config from '../config';

run(config).catch(error => {
  process.stderr.write(
    `Fatal error: ${error instanceof Error ? error.message : error}\n`,
  );
  process.exit(2);
});
```

### 4. Create a local-backend wrapper

Create `cli-test/local-backend.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export E2E_PROJECT_ROOT="$PROJECT_ROOT"
export E2E_TEST_COMMAND="npx tsx $PROJECT_ROOT/cli-test/bin/my-test.ts run --format=human"
export E2E_KEYGEN_SCRIPT="convex-e2e/scripts/generate-keys.ts"
export E2E_JWT_ENV_VARS="JWT_PRIVATE_KEY=test-private.pem JWKS=test-jwks.json"

exec bash "$PROJECT_ROOT/convex-e2e/scripts/local-backend.sh" "$@"
```

### 5. Add scripts to `package.json`

```json
{
  "scripts": {
    "test:e2e": "bash cli-test/local-backend.sh",
    "test:e2e:dev": "tsx cli-test/bin/my-test.ts run --format=human",
    "test:e2e:smoke": "tsx cli-test/bin/my-test.ts run smoke"
  }
}
```

### 6. Add to `.gitignore`

```gitignore
# e2e testing
/.local-backend
/convex_local_storage
convex_local_backend.sqlite3
.env.e2e
.env.local.backup
test-private.pem
test-jwks.json
```

---

## What Your Project Must Provide

### A. Convex Backend Functions

The module calls your Convex functions by string path (configured in `convexFunctions`). You must implement these in your `convex/` directory:

#### `testSupport/auth:createTestSession`

An `internalAction` that looks up a user by email, creates a database session, and signs a JWT.

**Signature:** `(args: { email: string }) => { userId: string; token: string }`

**Requirements:**

- A `users` table with an `email` field and a `by_email` index
- Auth tables (`authSessions`, `authRefreshTokens`) -- provided by `@convex-dev/auth`
- `JWT_PRIVATE_KEY` and `CONVEX_SITE_URL` environment variables (set automatically by the local backend script)
- Uses `jose` (available transitively via `@convex-dev/auth`, or install directly)

```typescript
import { internalAction, internalMutation } from '../_generated/server';
import { v } from 'convex/values';
import { SignJWT, importPKCS8 } from 'jose';

export const createTestSession = internalAction({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ userId: string; token: string }> => {
    const session = await ctx.runMutation(
      internal.testSupport.auth.createSessionInDb,
      { email: args.email },
    );
    const privateKey = await importPKCS8(process.env.JWT_PRIVATE_KEY!, 'RS256');
    const token = await new SignJWT({
      sub: `${session.userId}|${session.sessionId}`,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setIssuer(process.env.CONVEX_SITE_URL!)
      .setAudience('convex')
      .setExpirationTime('30d')
      .sign(privateKey);
    return { userId: session.userId, token };
  },
});
```

#### `testSupport/inspect:getSeedIdMap`

An `internalQuery` that reads a stored ID map from a key-value table.

**Signature:** `() => Record<string, string> | {}`

**Requirements:**

- An `appSettings` table with `key: v.string()`, `value: v.string()`, and index `by_key` on `['key']`

```typescript
export const getSeedIdMap = internalQuery({
  args: {},
  handler: async ctx => {
    const setting = await ctx.db
      .query('appSettings')
      .withIndex('by_key', q => q.eq('key', 'test_seed_id_map'))
      .first();
    if (!setting) return {};
    return JSON.parse(setting.value) as Record<string, string>;
  },
});
```

#### `testSupport/inspect:listRecords`

An `internalQuery` for debugging -- lists records from any table.

**Signature:** `(args: { table: string; limit?: number }) => Document[]`

#### `testSupport/cleanup:deleteDocuments`

An `internalMutation` that deletes tracked test entities by ID.

**Signature:** `(args: { ids: Array<{ table: string; id: string }> }) => { deleted: number }`

```typescript
export const deleteDocuments = internalMutation({
  args: {
    ids: v.array(v.object({ table: v.string(), id: v.string() })),
  },
  handler: async (ctx, args) => {
    let deleted = 0;
    for (const { id } of args.ids) {
      try {
        await ctx.db.delete(id as any);
        deleted++;
      } catch {
        // Already deleted
      }
    }
    return { deleted };
  },
});
```

#### `testData/seed:seedBase` / `seedAll` / `clearAll`

`internalAction`s that insert/clear seed data. The `seedBase` action is called automatically when the runner detects an empty backend. See `convex-helpers/seed.ts` for a reference implementation.

### B. Seed Data

Create `convex/testData/data.ts` with your project's seed records. Use symbolic references (`@@key`) for cross-table dependencies:

```typescript
export const users = [
  {
    _symId: '@@admin',
    email: 'admin@my-project.test',
    name: 'Admin',
    role: 'admin',
  },
  {
    _symId: '@@editor',
    email: 'editor@my-project.test',
    name: 'Editor',
    role: 'editor',
  },
];

export const permissions = [
  {
    role: 'admin',
    resource: 'documents',
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  {
    role: 'editor',
    resource: 'documents',
    create: true,
    read: true,
    update: true,
    delete: false,
  },
];

export const seedOrder = [
  { table: 'users', records: users },
  { table: 'permissions', records: permissions },
];

export const baseSeedOrder = seedOrder;
export const clearOrder = ['permissions', 'users'];
```

### C. Schema Requirements

Your Convex schema must include:

```typescript
appSettings: defineTable({
  key: v.string(),
  value: v.string(),
  updatedAt: v.optional(v.number()),
}).index('by_key', ['key']),
```

The auth tables (`authSessions`, `authRefreshTokens`) are provided automatically by `@convex-dev/auth`.

### D. Test Suites

Write tests under `cli-test/tests/` and register them:

```typescript
// cli-test/tests/smoke.ts
import type { TestSuite } from '../lib/types';

export const smokeTests: TestSuite = {
  name: 'smoke',
  tests: [
    {
      name: 'can connect',
      run: async ctx => {
        const result = await ctx.client.query(api.myTable.list, {});
        assert.ok(Array.isArray(result));
      },
    },
  ],
};
```

```typescript
// cli-test/tests/index.ts
import type { TestSuite } from '../lib/types';
import { smokeTests } from './smoke';

export function loadAllSuites(): TestSuite[] {
  return [smokeTests];
}
```

### E. Type Re-export Shims (recommended)

Create thin re-export files in `cli-test/lib/` so test imports stay clean:

```typescript
// cli-test/lib/types.ts
import type {
  TestContext as GenericTestContext,
  TestSuite as GenericTestSuite,
} from '../../convex-e2e/src/types';

export type Role = 'admin' | 'editor' | 'viewer';
export type TestContext = GenericTestContext<Role>;
export type TestSuite = GenericTestSuite<Role>;
export type { SeedId, SeedData } from '../../convex-e2e/src/types';
```

```typescript
// cli-test/lib/assertions.ts
export {
  assert,
  assertThrows,
  assertDefined,
  assertMinLength,
  assertForbidden,
  assertNotPermissionFailure,
} from '../../convex-e2e/src/assertions';
```

```typescript
// cli-test/lib/convex-run.ts
export { convexRun, convexRunAsync } from '../../convex-e2e/src/convex-run';
```

This way your tests import from `../lib/types` and never reference `convex-e2e` directly. When you later publish as an npm package, only the shims change.

---

## Config Reference

```typescript
interface ConvexE2EConfig<R extends string> {
  /** Display name used in reports and help text. */
  projectName: string;

  /** Absolute path to the project root. Defaults to process.cwd(). */
  projectRoot?: string;

  /** Map of role names to seed user email addresses. */
  roles: Record<R, string>;

  /** The role used for suite-level context and asAdmin(). */
  defaultRole: R;

  /** Convex function paths (format: "module/path:functionName"). */
  convexFunctions: {
    createSession: string; // internalAction: email -> { userId, token }
    seedBase: string; // internalAction: seeds minimal data
    seedAll: string; // internalAction: seeds all data
    clearAll: string; // internalAction: clears all test data
    getSeedIdMap: string; // internalQuery: returns stored ID map
    deleteTracked: string; // internalMutation: batch-deletes by ID
    listRecords: string; // internalQuery: lists records in a table
  };

  /** Returns all test suites to run. */
  loadSuites: () => TestSuite<R>[];

  /** .env files to load (relative to projectRoot). Defaults to ['.env.local', '.env', '.env.test']. */
  envFiles?: string[];
}
```

---

## CLI Commands

```
npx tsx cli-test/bin/my-test.ts <command> [options]

Commands:
  run [filter]       Run tests (optionally filtered by suite name prefix)
  seed               Load all seed data
  clear              Clear all test data
  reset              Clear + seed
  list               List all suites and tests as JSON
  inspect <table>    Show records in a table

Options:
  --format=json|human  Output format (default: human)
  --json               Shorthand for --format=json
  --verbose            Show detailed output
  --bail               Stop on first failure
  --timeout=<ms>       Per-test timeout (default: 30000)
  --deployment=<url>   Override Convex URL

Examples:
  npx tsx cli-test/bin/my-test.ts run smoke
  npx tsx cli-test/bin/my-test.ts run crud
  npx tsx cli-test/bin/my-test.ts run --bail --verbose
```

---

## Local Backend Script

The `scripts/local-backend.sh` orchestrates an isolated test environment:

1. Downloads `convex-local-backend` (cached in `.local-backend/`)
2. Starts the backend on a local port
3. Generates JWT key pair for test auth
4. Deploys your Convex functions
5. Sets `JWT_PRIVATE_KEY` and `JWKS` environment variables
6. Runs your test command
7. Cleans up everything on exit (backend, temp files, restores `.env.local`)

It is controlled via environment variables set by your project wrapper script:

| Variable            | Required | Description                                                                                        |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `E2E_PROJECT_ROOT`  | yes      | Absolute path to project root                                                                      |
| `E2E_TEST_COMMAND`  | yes      | Command to run tests                                                                               |
| `E2E_KEYGEN_SCRIPT` | yes      | Path to key generation script (relative to root)                                                   |
| `E2E_JWT_ENV_VARS`  | no       | Space-separated `KEY=file` pairs (default: `JWT_PRIVATE_KEY=test-private.pem JWKS=test-jwks.json`) |
| `CONVEX_LOCAL_PORT` | no       | Backend port (default: `3210`)                                                                     |

---

## npm Dependencies

The module requires these packages (likely already in your project):

| Package  | Why                                                              |
| -------- | ---------------------------------------------------------------- |
| `convex` | ConvexHttpClient for API calls                                   |
| `dotenv` | Loads `.env.*` files in the CLI                                  |
| `jose`   | JWT signing in `testSupport/auth.ts` (or via `@convex-dev/auth`) |
| `tsx`    | Runs TypeScript CLI and key generation                           |

---

## Convex Helpers

The `convex-helpers/` directory contains reference implementations for the Convex-side functions. Since Convex functions must live inside your project's `convex/` directory, these are meant to be copied and adapted -- not imported at runtime.

- `convex-helpers/seed.ts` -- `resolveRefs()` pure function + template for `insertBatch`, `clearTable`, `seedAll`, `seedBase`, `clearAll`
- `convex-helpers/inspect.ts` -- template for `getSeedIdMap`, `storeSeedIdMap`, `countRecords`, `listRecords`

---

## Test Isolation

The runner tracks all entities created during a test via `ctx.track(table, id)`. After each test (and each suite), tracked entities are batch-deleted via the configured `deleteTracked` function. This happens in a `finally` block, so cleanup runs even when tests fail.

For full isolation, use `yarn test:e2e` (local backend). For debugging against a running deployment, use `yarn test:e2e:dev`.
