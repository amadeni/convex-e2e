import path from 'path';
import dotenv from 'dotenv';
import { convexRun } from './convex-run';
import { setProjectRoot } from './convex-run';
import { setProjectName } from './reporter';
import { runTests } from './runner';
import { buildReport, outputReport } from './reporter';
import type { ConvexE2EConfig, CliOptions, OutputFormat } from './types';

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const options: CliOptions = {
    command: 'run',
    format: 'human',
    verbose: false,
    bail: false,
    timeout: 30_000,
    isolation: 'suite',
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (
      arg === 'run' ||
      arg === 'seed' ||
      arg === 'clear' ||
      arg === 'reset' ||
      arg === 'list' ||
      arg === 'inspect'
    ) {
      options.command = arg;
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        i++;
        if (arg === 'inspect') {
          options.inspectTable = args[i];
        } else if (arg === 'run') {
          options.filter = args[i];
        }
      }
    } else if (arg.startsWith('--format=')) {
      options.format = arg.split('=')[1] as OutputFormat;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--bail') {
      options.bail = true;
    } else if (arg.startsWith('--timeout=')) {
      options.timeout = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--isolation=')) {
      options.isolation = arg.split('=')[1] as 'suite' | 'test' | 'append';
    } else if (arg.startsWith('--deployment=')) {
      options.deployment = arg.split('=')[1];
    } else if (arg === '--json') {
      options.format = 'json';
    } else if (arg === '--help' || arg === '-h') {
      return { ...options, command: 'run', filter: '__help__' };
    } else if (
      !arg.startsWith('--') &&
      !options.filter &&
      options.command === 'run'
    ) {
      options.filter = arg;
    }

    i++;
  }

  return options;
}

function printHelp<R extends string>(config: ConvexE2EConfig<R>): void {
  process.stdout.write(`
${config.projectName} E2E Test Runner

Usage: npx tsx <entry-point> <command> [options]

Commands:
  run [filter]       Run tests (optionally filtered by suite name)
  seed               Load seed data
  clear              Clear all test data
  reset              Clear + seed
  list               List all available test suites (JSON)
  inspect <table>    Show records in a table

Options:
  --format=json|human  Output format (default: human)
  --json               Shorthand for --format=json
  --verbose            Show detailed output
  --bail               Stop on first failure
  --timeout=<ms>       Timeout per test (default: 30000)
  --isolation=<level>  Isolation level: suite|test|append (default: suite)
  --deployment=<url>   Override Convex deployment URL
`);
}

/**
 * Main entry point for the CLI. Accepts a project config and runs the tool.
 */
export async function run<R extends string>(
  config: ConvexE2EConfig<R>,
): Promise<void> {
  const projectRoot = config.projectRoot || process.cwd();
  setProjectRoot(projectRoot);
  setProjectName(config.projectName);

  const envFiles = config.envFiles || ['.env.local', '.env', '.env.test'];
  for (const envFile of envFiles) {
    dotenv.config({ path: path.resolve(projectRoot, envFile) });
  }

  const options = parseArgs(process.argv);

  if (options.filter === '__help__') {
    printHelp(config);
    process.exit(0);
  }

  switch (options.command) {
    case 'seed': {
      process.stderr.write('Seeding test data...\n');
      try {
        const result = convexRun(config.convexFunctions.seedAll);
        process.stderr.write(`Seed complete: ${JSON.stringify(result)}\n`);
      } catch (error) {
        process.stderr.write(
          `Seed failed: ${error instanceof Error ? error.message : error}\n`,
        );
        process.exit(2);
      }
      break;
    }

    case 'clear': {
      process.stderr.write('Clearing test data...\n');
      try {
        const result = convexRun(config.convexFunctions.clearAll);
        process.stderr.write(`Clear complete: ${JSON.stringify(result)}\n`);
      } catch (error) {
        process.stderr.write(
          `Clear failed: ${error instanceof Error ? error.message : error}\n`,
        );
        process.exit(2);
      }
      break;
    }

    case 'reset': {
      process.stderr.write('Resetting test data (clear + seed)...\n');
      try {
        convexRun(config.convexFunctions.clearAll);
        convexRun(config.convexFunctions.seedAll);
        process.stderr.write('Reset complete.\n');
      } catch (error) {
        process.stderr.write(
          `Reset failed: ${error instanceof Error ? error.message : error}\n`,
        );
        process.exit(2);
      }
      break;
    }

    case 'list': {
      const suites = config.loadSuites();
      const listing = suites.map(s => ({
        name: s.name,
        tests: s.tests.map(t => ({
          name: t.name,
          role: t.role || config.defaultRole,
          tags: t.tags || [],
          skip: !!t.skip,
        })),
      }));
      process.stdout.write(JSON.stringify(listing, null, 2) + '\n');
      break;
    }

    case 'inspect': {
      if (!options.inspectTable) {
        process.stderr.write('Usage: inspect <table>\n');
        process.exit(4);
      }
      try {
        const records = convexRun(config.convexFunctions.listRecords, {
          table: options.inspectTable,
          limit: 50,
        });
        process.stdout.write(JSON.stringify(records, null, 2) + '\n');
      } catch (error) {
        process.stderr.write(
          `Inspect failed: ${error instanceof Error ? error.message : error}\n`,
        );
        process.exit(2);
      }
      break;
    }

    case 'run': {
      const startTime = Date.now();
      const suites = config.loadSuites();

      try {
        const suiteResults = await runTests(config, suites, options);
        const report = buildReport(suiteResults, startTime);
        outputReport(report, options.format, options.format === 'human');

        if (report.summary.failed > 0) {
          process.exit(1);
        }
      } catch (error) {
        process.stderr.write(
          `Test run failed: ${error instanceof Error ? error.message : error}\n`,
        );
        if (error instanceof Error && error.stack) {
          process.stderr.write(error.stack + '\n');
        }
        process.exit(2);
      }
      break;
    }
  }
}
