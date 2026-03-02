import assert from 'node:assert/strict';

export { assert };

/**
 * Assert that a function throws an error matching the given pattern.
 */
export async function assertThrows(
  fn: () => Promise<unknown>,
  pattern?: RegExp | string,
  message?: string,
): Promise<void> {
  let threw = false;
  let error: unknown;

  try {
    await fn();
  } catch (e) {
    threw = true;
    error = e;
  }

  if (!threw) {
    throw new assert.AssertionError({
      message: message || 'Expected function to throw',
      operator: 'throws',
    });
  }

  if (pattern) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const regex =
      typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    if (!regex.test(errorMessage)) {
      throw new assert.AssertionError({
        message:
          message || `Expected error to match ${regex}, got: "${errorMessage}"`,
        expected: String(regex),
        actual: errorMessage,
        operator: 'throws',
      });
    }
  }
}

/**
 * Assert that a value is defined (not null/undefined).
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new assert.AssertionError({
      message: message || 'Expected value to be defined',
      actual: value,
      operator: 'defined',
    });
  }
}

/**
 * Assert that an array has at least the given number of items.
 */
export function assertMinLength(
  arr: unknown[],
  min: number,
  message?: string,
): void {
  if (arr.length < min) {
    throw new assert.AssertionError({
      message: message || `Expected at least ${min} items, got ${arr.length}`,
      expected: `>= ${min}`,
      actual: String(arr.length),
      operator: 'minLength',
    });
  }
}

/**
 * Assert that an error represents a permission/access denial.
 */
export async function assertForbidden(
  fn: () => Promise<unknown>,
  message?: string,
): Promise<void> {
  await assertThrows(
    fn,
    /(access denied|only admins?|unauthorized|admin role required|forbidden)/i,
    message || 'Expected permission/access error',
  );
}

/**
 * Assert a function either succeeds, or fails for domain reasons
 * that are explicitly acceptable for this test environment.
 */
export async function assertNotPermissionFailure(
  fn: () => Promise<unknown>,
  message?: string,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPermissionError =
      /(access denied|only admins?|unauthorized|admin role required|forbidden)/i.test(
        errorMessage,
      );
    if (isPermissionError) {
      throw new assert.AssertionError({
        message:
          message ||
          `Expected non-permission outcome, but got permission error: ${errorMessage}`,
        actual: errorMessage,
        operator: 'notPermissionFailure',
      });
    }
  }
}
