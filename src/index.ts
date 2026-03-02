import type { ConvexE2EConfig } from './types';

export type {
  ConvexE2EConfig,
  TestContext,
  TestDefinition,
  TestSuite,
  TestResult,
  SuiteResult,
  TestReport,
  TestStatus,
  TestAuthManager,
  CliOptions,
  OutputFormat,
  SeedData,
  SeedId,
} from './types';

export { run } from './cli';
export { convexRun, convexRunAsync, setProjectRoot } from './convex-run';
export {
  createClient,
  createAuthenticatedClient,
  getConvexUrl,
} from './client';
export { TestAuthManagerImpl } from './auth';
export { runTests } from './runner';
export {
  buildReport,
  outputReport,
  formatJson,
  formatHuman,
  formatHumanSummary,
  printTestResult,
  printSuiteHeader,
  setProjectName,
} from './reporter';
export {
  assert,
  assertThrows,
  assertDefined,
  assertMinLength,
  assertForbidden,
  assertNotPermissionFailure,
} from './assertions';

/**
 * Helper to define a type-safe project config.
 * Infers the role union type from the `roles` record keys.
 */
export function defineConfig<R extends string>(
  config: ConvexE2EConfig<R>,
): ConvexE2EConfig<R> {
  return config;
}
