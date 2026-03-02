import { describe, it, expect } from 'vitest';
import { filterSuites, parseError } from '../src/runner';
import type { TestSuite } from '../src/types';

const makeSuites = (): TestSuite[] => [
  { name: 'auth', tests: [] },
  { name: 'auth:login', tests: [] },
  { name: 'items', tests: [] },
  { name: 'items:crud', tests: [] },
  { name: 'admin', tests: [] },
];

describe('filterSuites', () => {
  it('returns all suites when no filter', () => {
    const suites = makeSuites();
    expect(filterSuites(suites)).toHaveLength(5);
    expect(filterSuites(suites, undefined)).toHaveLength(5);
  });

  it('matches exact name (case-insensitive)', () => {
    const result = filterSuites(makeSuites(), 'AUTH');
    const names = result.map(s => s.name);
    expect(names).toContain('auth');
    expect(names).toContain('auth:login');
  });

  it('matches by prefix', () => {
    const result = filterSuites(makeSuites(), 'item');
    const names = result.map(s => s.name);
    expect(names).toContain('items');
    expect(names).toContain('items:crud');
    expect(names).not.toContain('auth');
  });

  it('returns empty for non-matching filter', () => {
    expect(filterSuites(makeSuites(), 'nonexistent')).toHaveLength(0);
  });
});

describe('parseError', () => {
  it('extracts message and stack from Error', () => {
    const err = new Error('something broke');
    const result = parseError(err);

    expect(result?.message).toBe('something broke');
    expect(result?.stack).toBeTruthy();
  });

  it('extracts expected/actual from assertion errors', () => {
    const err = Object.assign(new Error('mismatch'), {
      expected: 'foo',
      actual: 'bar',
    });
    const result = parseError(err);

    expect(result?.expected).toBe('foo');
    expect(result?.actual).toBe('bar');
  });

  it('handles non-Error values', () => {
    expect(parseError('string error')?.message).toBe('string error');
    expect(parseError(42)?.message).toBe('42');
    expect(parseError(null)?.message).toBe('null');
  });
});
