import type {
  TestReport,
  SuiteResult,
  TestResult,
  OutputFormat,
} from './types';
import { getConvexUrl } from './client';

let configuredProjectName = 'E2E Test';

export function setProjectName(name: string): void {
  configuredProjectName = name;
}

/**
 * Build the full test report object.
 */
export function buildReport(
  suiteResults: SuiteResult[],
  startTime: number,
): TestReport {
  const totalDuration = Date.now() - startTime;
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const suite of suiteResults) {
    for (const test of suite.tests) {
      total++;
      if (test.status === 'passed') passed++;
      else if (test.status === 'failed') failed++;
      else if (test.status === 'skipped') skipped++;
    }
  }

  let deploymentUrl: string;
  try {
    deploymentUrl = getConvexUrl();
  } catch {
    deploymentUrl = 'unknown';
  }

  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    deployment: deploymentUrl,
    summary: {
      total,
      passed,
      failed,
      skipped,
      duration_ms: totalDuration,
    },
    suites: suiteResults,
    environment: {
      node_version: process.version,
      convex_version: getConvexVersion(),
      seed_data_version: new Date().toISOString().split('T')[0],
    },
  };
}

function getConvexVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('convex/package.json') as { version: string };
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

/**
 * Format the report as JSON string.
 */
export function formatJson(report: TestReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format the report as human-readable output.
 */
export function formatHuman(report: TestReport): string {
  const lines: string[] = [];
  const sep = '\u2550'.repeat(54);

  lines.push(sep);
  lines.push(`  ${configuredProjectName} E2E Test Results`);
  lines.push(`  Deployment: ${report.deployment}`);
  lines.push(`  ${new Date(report.timestamp).toLocaleString()}`);
  lines.push(sep);
  lines.push('');

  for (const suite of report.suites) {
    const suiteStatus = suite.status === 'passed' ? 'PASS' : 'FAIL';
    const dots = '.'.repeat(
      Math.max(2, 50 - suite.name.length - suiteStatus.length),
    );
    lines.push(
      `  ${suite.name.toUpperCase()} ${dots} ${suiteStatus} (${formatMs(suite.duration_ms)})`,
    );

    for (const test of suite.tests) {
      if (test.status === 'passed') {
        lines.push(
          `    \u2713 ${test.name}${padMs(test.duration_ms, test.name)}`,
        );
      } else if (test.status === 'failed') {
        lines.push(
          `    \u2717 ${test.name}${padMs(test.duration_ms, test.name)}`,
        );
        if (test.error) {
          lines.push(`      \u2192 ${test.error.message}`);
        }
      } else {
        lines.push(`    - ${test.name}${padMs(0, test.name)}SKIP`);
      }
    }

    lines.push('');
  }

  lines.push(sep);
  const { passed, failed, skipped, duration_ms } = report.summary;
  lines.push(
    `  ${passed} passed | ${failed} failed | ${skipped} skipped | ${formatMs(duration_ms)}`,
  );
  lines.push(sep);

  return lines.join('\n');
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function padMs(ms: number, name: string): string {
  const totalWidth = 50;
  const padding = Math.max(2, totalWidth - name.length - 4);
  return ' '.repeat(padding) + formatMs(ms);
}

/**
 * Format just the summary footer (used after live streaming in human mode).
 */
export function formatHumanSummary(report: TestReport): string {
  const lines: string[] = [];
  const sep = '\u2550'.repeat(54);

  lines.push('');
  lines.push(sep);
  const { passed, failed, skipped, duration_ms } = report.summary;
  lines.push(
    `  ${passed} passed | ${failed} failed | ${skipped} skipped | ${formatMs(duration_ms)}`,
  );
  lines.push(sep);

  return lines.join('\n');
}

/**
 * Output the report in the requested format.
 */
export function outputReport(
  report: TestReport,
  format: OutputFormat,
  streamed: boolean,
): void {
  if (format === 'json') {
    process.stdout.write(formatJson(report) + '\n');
  } else if (streamed) {
    process.stderr.write(formatHumanSummary(report) + '\n');
  } else {
    process.stdout.write(formatHuman(report) + '\n');
  }
}

/**
 * Print a single test result during execution (for human format).
 */
export function printTestResult(test: TestResult, verbose: boolean): void {
  if (test.status === 'passed') {
    process.stderr.write(
      `    \u2713 ${test.name} (${formatMs(test.duration_ms)})\n`,
    );
  } else if (test.status === 'failed') {
    process.stderr.write(
      `    \u2717 ${test.name} (${formatMs(test.duration_ms)})\n`,
    );
    if (test.error) {
      process.stderr.write(`      \u2192 ${test.error.message}\n`);
      if (verbose && test.error.stack) {
        process.stderr.write(`      ${test.error.stack}\n`);
      }
    }
  } else {
    const reason = typeof test.status === 'string' ? test.status : 'skipped';
    process.stderr.write(`    - ${test.name} (${reason})\n`);
  }
}

/**
 * Print suite header during execution.
 */
export function printSuiteHeader(suiteName: string): void {
  process.stderr.write(`\n  ${suiteName.toUpperCase()}\n`);
}
