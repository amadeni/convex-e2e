import { execFileSync } from 'child_process';

const FUNCTION_PATH_PATTERN = /^[a-zA-Z0-9/_-]+:[a-zA-Z0-9_-]+$/;

let resolvedProjectRoot: string | undefined;

export function setProjectRoot(root: string): void {
  resolvedProjectRoot = root;
}

function getProjectRoot(): string {
  return resolvedProjectRoot || process.cwd();
}

/**
 * Wrapper around `npx convex run` for calling internal functions.
 * Returns parsed JSON output from the Convex function.
 */
export function convexRun(
  functionPath: string,
  args?: Record<string, unknown>,
): unknown {
  if (!FUNCTION_PATH_PATTERN.test(functionPath)) {
    throw new Error(
      `Invalid function path: "${functionPath}". Must match ${FUNCTION_PATH_PATTERN.source}`,
    );
  }
  const argsJson = args ? JSON.stringify(args) : '{}';

  const convexArgs = ['convex', 'run'];
  const envFile = process.env.CONVEX_ENV_FILE;
  if (envFile) {
    convexArgs.push('--env-file', envFile);
  }
  convexArgs.push(functionPath, argsJson);

  const output = execFileSync('npx', convexArgs, {
    cwd: getProjectRoot(),
    encoding: 'utf-8',
    timeout: 60_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const trimmed = output.trim();
  if (!trimmed) return undefined;

  return parseConvexOutput(trimmed);
}

/**
 * Async version of convexRun using a Promise wrapper.
 */
export async function convexRunAsync(
  functionPath: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  return convexRun(functionPath, args);
}

function parseConvexOutput(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    const lines = output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    for (let startIndex = lines.length - 1; startIndex >= 0; startIndex--) {
      const candidate = lines.slice(startIndex).join('\n');
      try {
        return JSON.parse(candidate);
      } catch {
        // Keep trying earlier start lines.
      }
    }

    return output;
  }
}
