import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SuiteResult, TestReport } from '../src/types';

vi.mock('../src/client', () => ({
  getConvexUrl: () => 'https://test.convex.cloud',
}));

import {
  buildReport,
  formatJson,
  formatHuman,
  formatHumanSummary,
  setProjectName,
} from '../src/reporter';

const makeSuiteResults = (): SuiteResult[] => [
  {
    name: 'auth',
    status: 'passed',
    duration_ms: 150,
    tests: [
      { name: 'login works', status: 'passed', duration_ms: 50 },
      { name: 'logout works', status: 'passed', duration_ms: 100 },
    ],
  },
  {
    name: 'items',
    status: 'failed',
    duration_ms: 300,
    tests: [
      { name: 'can create', status: 'passed', duration_ms: 80 },
      {
        name: 'validates input',
        status: 'failed',
        duration_ms: 220,
        error: { message: 'Expected error to be thrown' },
      },
    ],
  },
];

describe('buildReport', () => {
  beforeEach(() => {
    setProjectName('Test Project');
  });

  it('counts passed, failed, and skipped tests', () => {
    const suites: SuiteResult[] = [
      {
        name: 'suite',
        status: 'passed',
        duration_ms: 100,
        tests: [
          { name: 'a', status: 'passed', duration_ms: 30 },
          { name: 'b', status: 'failed', duration_ms: 40 },
          { name: 'c', status: 'skipped', duration_ms: 0 },
        ],
      },
    ];

    const startTime = Date.now() - 500;
    const report = buildReport(suites, startTime);

    expect(report.summary.total).toBe(3);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(1);
    expect(report.summary.skipped).toBe(1);
    expect(report.summary.duration_ms).toBeGreaterThanOrEqual(400);
  });

  it('includes deployment url and metadata', () => {
    const report = buildReport(makeSuiteResults(), Date.now());

    expect(report.version).toBe('1.0.0');
    expect(report.deployment).toBe('https://test.convex.cloud');
    expect(report.timestamp).toBeTruthy();
    expect(report.environment.node_version).toBe(process.version);
  });

  it('preserves suite results', () => {
    const suites = makeSuiteResults();
    const report = buildReport(suites, Date.now());

    expect(report.suites).toHaveLength(2);
    expect(report.suites[0].name).toBe('auth');
    expect(report.suites[1].name).toBe('items');
  });
});

describe('formatJson', () => {
  it('produces valid JSON string', () => {
    const report = buildReport(makeSuiteResults(), Date.now());
    const json = formatJson(report);
    const parsed = JSON.parse(json) as TestReport;

    expect(parsed.version).toBe('1.0.0');
    expect(parsed.suites).toHaveLength(2);
  });
});

describe('formatHuman', () => {
  beforeEach(() => {
    setProjectName('Test Project');
  });

  it('includes project name', () => {
    const report = buildReport(makeSuiteResults(), Date.now());
    const output = formatHuman(report);

    expect(output).toContain('Test Project E2E Test Results');
  });

  it('shows pass/fail indicators', () => {
    const report = buildReport(makeSuiteResults(), Date.now());
    const output = formatHuman(report);

    expect(output).toContain('\u2713');
    expect(output).toContain('\u2717');
  });

  it('shows suite names uppercased', () => {
    const report = buildReport(makeSuiteResults(), Date.now());
    const output = formatHuman(report);

    expect(output).toContain('AUTH');
    expect(output).toContain('ITEMS');
  });

  it('includes summary line', () => {
    const report = buildReport(makeSuiteResults(), Date.now());
    const output = formatHuman(report);

    expect(output).toContain('3 passed');
    expect(output).toContain('1 failed');
    expect(output).toContain('0 skipped');
  });

  it('includes error messages', () => {
    const report = buildReport(makeSuiteResults(), Date.now());
    const output = formatHuman(report);

    expect(output).toContain('Expected error to be thrown');
  });
});

describe('formatHumanSummary', () => {
  it('includes summary counts', () => {
    const report = buildReport(makeSuiteResults(), Date.now());
    const output = formatHumanSummary(report);

    expect(output).toContain('3 passed');
    expect(output).toContain('1 failed');
  });
});
