import { ConvexHttpClient } from 'convex/browser';

/**
 * Seed data maps symbolic IDs (@@key) to real Convex document IDs.
 * At runtime these are strings, but they represent typed Convex IDs.
 * We use `string & { __tableName: never }` so values are assignable to
 * any branded Id<T> type without explicit casting in test code.
 */
export type SeedId = string & { __tableName: never };
export type SeedData = Record<string, SeedId>;

export interface TestAuthManager<R extends string = string> {
  getTokenForRole(role: R): Promise<string>;
}

export interface TestContext<R extends string = string> {
  client: ConvexHttpClient;
  auth: TestAuthManager<R>;
  userId: string;
  role: R;
  seedData: SeedData;
  track: (table: string, id: string) => void;
  asAdmin: <T>(fn: (c: ConvexHttpClient) => Promise<T>) => Promise<T>;
  actAs: <T>(role: R, fn: (c: ConvexHttpClient) => Promise<T>) => Promise<T>;
  log: (msg: string) => void;
}

export interface TestDefinition<R extends string = string> {
  name: string;
  tags?: string[];
  role?: R;
  isolation?: 'suite' | 'test' | 'append';
  timeout?: number;
  skip?: boolean | string;
  run: (ctx: TestContext<R>) => Promise<void>;
}

export interface TestSuite<R extends string = string> {
  name: string;
  isolation?: 'suite' | 'test' | 'append';
  beforeAll?: (ctx: TestContext<R>) => Promise<void>;
  afterAll?: (ctx: TestContext<R>) => Promise<void>;
  beforeEach?: (ctx: TestContext<R>) => Promise<void>;
  afterEach?: (ctx: TestContext<R>) => Promise<void>;
  tests: TestDefinition<R>[];
}

export type TestStatus = 'passed' | 'failed' | 'skipped';

export interface TestResult {
  name: string;
  status: TestStatus;
  duration_ms: number;
  error?: {
    message: string;
    expected?: string;
    actual?: string;
    stack?: string;
  };
}

export interface SuiteResult {
  name: string;
  status: TestStatus;
  duration_ms: number;
  tests: TestResult[];
}

export interface TestReport {
  version: string;
  timestamp: string;
  deployment: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration_ms: number;
  };
  suites: SuiteResult[];
  environment: {
    node_version: string;
    convex_version: string;
    seed_data_version: string;
  };
}

export type OutputFormat = 'json' | 'human';

export interface CliOptions {
  command: 'run' | 'seed' | 'clear' | 'reset' | 'list' | 'inspect';
  filter?: string;
  format: OutputFormat;
  verbose: boolean;
  bail: boolean;
  timeout: number;
  isolation: 'suite' | 'test' | 'append';
  deployment?: string;
  inspectTable?: string;
}

export interface ConvexE2EConfig<R extends string = string> {
  projectName: string;
  projectRoot?: string;
  roles: Record<R, string>;
  defaultRole: R;
  convexFunctions: {
    createSession: string;
    seedBase: string;
    seedAll: string;
    clearAll: string;
    getSeedIdMap: string;
    deleteTracked: string;
    listRecords: string;
  };
  loadSuites: () => TestSuite<R>[];
  envFiles?: string[];
}
