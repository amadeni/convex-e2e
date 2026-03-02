import { describe, it, expect } from 'vitest';
import {
  assertDefined,
  assertMinLength,
  assertThrows,
  assertForbidden,
  assertNotPermissionFailure,
} from '../src/assertions';

describe('assertDefined', () => {
  it('passes for truthy values', () => {
    expect(() => assertDefined('hello')).not.toThrow();
    expect(() => assertDefined(0)).not.toThrow();
    expect(() => assertDefined(false)).not.toThrow();
    expect(() => assertDefined('')).not.toThrow();
  });

  it('throws for null', () => {
    expect(() => assertDefined(null)).toThrow('Expected value to be defined');
  });

  it('throws for undefined', () => {
    expect(() => assertDefined(undefined)).toThrow(
      'Expected value to be defined',
    );
  });

  it('uses custom message', () => {
    expect(() => assertDefined(null, 'missing user')).toThrow('missing user');
  });
});

describe('assertMinLength', () => {
  it('passes when array meets minimum', () => {
    expect(() => assertMinLength([1, 2, 3], 2)).not.toThrow();
    expect(() => assertMinLength([1], 1)).not.toThrow();
  });

  it('throws when array is too short', () => {
    expect(() => assertMinLength([], 1)).toThrow('Expected at least 1 items');
    expect(() => assertMinLength([1], 3)).toThrow('Expected at least 3 items');
  });

  it('uses custom message', () => {
    expect(() => assertMinLength([], 1, 'need items')).toThrow('need items');
  });
});

describe('assertThrows', () => {
  it('passes when function throws', async () => {
    await expect(
      assertThrows(async () => {
        throw new Error('boom');
      }),
    ).resolves.toBeUndefined();
  });

  it('fails when function does not throw', async () => {
    await expect(
      assertThrows(async () => {
        /* no-op */
      }),
    ).rejects.toThrow('Expected function to throw');
  });

  it('matches error against string pattern', async () => {
    await expect(
      assertThrows(async () => {
        throw new Error('access denied for user');
      }, 'access denied'),
    ).resolves.toBeUndefined();
  });

  it('matches error against regex pattern', async () => {
    await expect(
      assertThrows(async () => {
        throw new Error('Access Denied');
      }, /access denied/i),
    ).resolves.toBeUndefined();
  });

  it('fails when error does not match pattern', async () => {
    await expect(
      assertThrows(async () => {
        throw new Error('something else');
      }, 'access denied'),
    ).rejects.toThrow('Expected error to match');
  });
});

describe('assertForbidden', () => {
  it('passes for permission errors', async () => {
    await expect(
      assertForbidden(async () => {
        throw new Error('access denied');
      }),
    ).resolves.toBeUndefined();

    await expect(
      assertForbidden(async () => {
        throw new Error('only admins can do this');
      }),
    ).resolves.toBeUndefined();

    await expect(
      assertForbidden(async () => {
        throw new Error('unauthorized request');
      }),
    ).resolves.toBeUndefined();
  });

  it('fails for non-permission errors', async () => {
    await expect(
      assertForbidden(async () => {
        throw new Error('network timeout');
      }),
    ).rejects.toThrow('Expected permission/access error');
  });

  it('fails when function does not throw', async () => {
    await expect(
      assertForbidden(async () => {
        /* succeeds */
      }),
    ).rejects.toThrow('Expected permission/access error');
  });
});

describe('assertNotPermissionFailure', () => {
  it('passes when function succeeds', async () => {
    await expect(
      assertNotPermissionFailure(async () => 'ok'),
    ).resolves.toBeUndefined();
  });

  it('passes for non-permission errors (swallows them)', async () => {
    await expect(
      assertNotPermissionFailure(async () => {
        throw new Error('not found');
      }),
    ).resolves.toBeUndefined();
  });

  it('fails for permission errors', async () => {
    await expect(
      assertNotPermissionFailure(async () => {
        throw new Error('access denied');
      }),
    ).rejects.toThrow('Expected non-permission outcome');
  });
});
