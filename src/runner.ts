import { ConvexHttpClient } from 'convex/browser';
import { convexRun } from './convex-run';
import { TestAuthManagerImpl } from './auth';
import { printTestResult, printSuiteHeader } from './reporter';
import type {
  ConvexE2EConfig,
  TestSuite,
  TestDefinition,
  TestContext,
  TestResult,
  SuiteResult,
  CliOptions,
  SeedData,
} from './types';

/**
 * Run all test suites matching the filter.
 */
export async function runTests<R extends string>(
  config: ConvexE2EConfig<R>,
  suites: TestSuite<R>[],
  options: CliOptions,
): Promise<SuiteResult[]> {
  const authManager = new TestAuthManagerImpl(config, options.deployment);

  const isEmpty = isBackendEmpty(config);
  if (isEmpty) {
    process.stderr.write('No seed data found. Auto-seeding base data...\n');
    convexRun(config.convexFunctions.seedBase);
    process.stderr.write('Auto-seed complete.\n');
  }

  const seedData = loadSeedIdMap(config);
  const results: SuiteResult[] = [];

  const filtered = filterSuites(suites, options.filter);

  if (filtered.length === 0) {
    process.stderr.write('No test suites match the filter.\n');
    return [];
  }

  for (const suite of filtered) {
    const suiteResult = await runSuite(
      config,
      suite,
      authManager,
      seedData,
      options,
    );
    results.push(suiteResult);

    if (options.bail && suiteResult.tests.some(t => t.status === 'failed')) {
      break;
    }
  }

  return results;
}

function loadSeedIdMap<R extends string>(config: ConvexE2EConfig<R>): SeedData {
  try {
    const result = convexRun(config.convexFunctions.getSeedIdMap);
    if (result && typeof result === 'object') {
      return result as SeedData;
    }
    return {};
  } catch {
    return {};
  }
}

function isBackendEmpty<R extends string>(config: ConvexE2EConfig<R>): boolean {
  try {
    const seedMap = convexRun(config.convexFunctions.getSeedIdMap);
    if (
      seedMap &&
      typeof seedMap === 'object' &&
      Object.keys(seedMap).length > 0
    ) {
      return false;
    }
  } catch {
    // If we can't read the seed map, treat as empty
  }
  return true;
}

/**
 * Filter suites by name prefix.
 */
export function filterSuites<R extends string>(
  suites: TestSuite<R>[],
  filter?: string,
): TestSuite<R>[] {
  if (!filter) return suites;

  return suites.filter(suite => {
    const lower = suite.name.toLowerCase();
    const filterLower = filter.toLowerCase();
    return (
      lower === filterLower ||
      lower.startsWith(filterLower + ':') ||
      lower.startsWith(filterLower)
    );
  });
}

/**
 * Run a single test suite.
 */
async function runSuite<R extends string>(
  config: ConvexE2EConfig<R>,
  suite: TestSuite<R>,
  authManager: TestAuthManagerImpl<R>,
  seedData: SeedData,
  options: CliOptions,
): Promise<SuiteResult> {
  const suiteStart = Date.now();
  const testResults: TestResult[] = [];

  if (options.format === 'human') {
    printSuiteHeader(suite.name);
  }

  const suiteCtx = await createTestContext(
    config,
    config.defaultRole,
    authManager,
    seedData,
    options,
  );

  try {
    if (suite.beforeAll) {
      await suite.beforeAll(suiteCtx);
    }

    for (const test of suite.tests) {
      const result = await runTest(
        config,
        test,
        suite,
        authManager,
        seedData,
        options,
      );
      testResults.push(result);

      if (options.format === 'human') {
        printTestResult(result, options.verbose);
      }

      if (options.bail && result.status === 'failed') {
        break;
      }
    }

    if (suite.afterAll) {
      await suite.afterAll(suiteCtx);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`  Suite error (${suite.name}): ${msg}\n`);
  }

  await cleanupTracked(config, suiteCtx);

  const suiteStatus = testResults.some(t => t.status === 'failed')
    ? 'failed'
    : testResults.every(t => t.status === 'skipped')
      ? 'skipped'
      : 'passed';

  return {
    name: suite.name,
    status: suiteStatus,
    duration_ms: Date.now() - suiteStart,
    tests: testResults,
  };
}

/**
 * Run a single test.
 */
async function runTest<R extends string>(
  config: ConvexE2EConfig<R>,
  test: TestDefinition<R>,
  suite: TestSuite<R>,
  authManager: TestAuthManagerImpl<R>,
  seedData: SeedData,
  options: CliOptions,
): Promise<TestResult> {
  if (test.skip) {
    return {
      name: test.name,
      status: 'skipped',
      duration_ms: 0,
    };
  }

  const role = test.role || config.defaultRole;
  const timeout = test.timeout || options.timeout;
  const start = Date.now();

  const ctx = await createTestContext(
    config,
    role,
    authManager,
    seedData,
    options,
  );

  try {
    if (suite.beforeEach) {
      await suite.beforeEach(ctx);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        test.run(ctx),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Test timed out after ${timeout}ms`)),
            timeout,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }

    if (suite.afterEach) {
      await suite.afterEach(ctx);
    }

    return {
      name: test.name,
      status: 'passed',
      duration_ms: Date.now() - start,
    };
  } catch (error) {
    const duration_ms = Date.now() - start;
    const errorObj = parseError(error);

    return {
      name: test.name,
      status: 'failed',
      duration_ms,
      error: errorObj,
    };
  } finally {
    await cleanupTracked(config, ctx);
  }
}

/**
 * Create a TestContext for a given role.
 */
async function createTestContext<R extends string>(
  config: ConvexE2EConfig<R>,
  role: R,
  authManager: TestAuthManagerImpl<R>,
  seedData: SeedData,
  options: CliOptions,
): Promise<
  TestContext<R> & { _tracked: Array<{ table: string; id: string }> }
> {
  const client = await authManager.createClientForRole(role);
  const userId = authManager.getUserIdForRole(role) || '';
  const tracked: Array<{ table: string; id: string }> = [];

  return {
    client,
    auth: authManager,
    userId,
    role,
    seedData,
    track: (table: string, id: string) => {
      tracked.push({ table, id });
    },
    asAdmin: async <T>(fn: (c: ConvexHttpClient) => Promise<T>): Promise<T> => {
      const adminClient = await authManager.createClientForRole(
        config.defaultRole,
      );
      return fn(adminClient);
    },
    actAs: async <T>(
      actRole: R,
      fn: (c: ConvexHttpClient) => Promise<T>,
    ): Promise<T> => {
      const roleClient = await authManager.createClientForRole(actRole);
      return fn(roleClient);
    },
    log: (msg: string) => {
      if (options.verbose) {
        process.stderr.write(`      [log] ${msg}\n`);
      }
    },
    _tracked: tracked,
  };
}

/**
 * Clean up documents tracked during a test.
 */
async function cleanupTracked<R extends string>(
  config: ConvexE2EConfig<R>,
  ctx: TestContext<R> & { _tracked?: Array<{ table: string; id: string }> },
): Promise<void> {
  if (!ctx._tracked || ctx._tracked.length === 0) return;

  try {
    convexRun(config.convexFunctions.deleteTracked, {
      ids: ctx._tracked,
    });
  } catch {
    // Cleanup errors are non-fatal
  }
}

/**
 * Parse an error into a structured error object.
 */
export function parseError(error: unknown): TestResult['error'] {
  if (error instanceof Error) {
    const result: TestResult['error'] = {
      message: error.message,
      stack: error.stack,
    };

    const assertError = error as {
      expected?: unknown;
      actual?: unknown;
    };
    if (assertError.expected !== undefined) {
      result.expected = String(assertError.expected);
    }
    if (assertError.actual !== undefined) {
      result.actual = String(assertError.actual);
    }

    return result;
  }

  return {
    message: String(error),
  };
}
