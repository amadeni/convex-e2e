import { describe, it, expect } from 'vitest';
import { parseConvexOutput, FUNCTION_PATH_PATTERN } from '../src/convex-run';

describe('FUNCTION_PATH_PATTERN', () => {
  it('matches valid function paths', () => {
    expect(FUNCTION_PATH_PATTERN.test('module:function')).toBe(true);
    expect(FUNCTION_PATH_PATTERN.test('testData/seed:seedAll')).toBe(true);
    expect(FUNCTION_PATH_PATTERN.test('testSupport/auth:createSession')).toBe(
      true,
    );
    expect(FUNCTION_PATH_PATTERN.test('deep/nested/path:fn')).toBe(true);
    expect(FUNCTION_PATH_PATTERN.test('with-dashes:my-func')).toBe(true);
    expect(FUNCTION_PATH_PATTERN.test('with_underscores:my_func')).toBe(true);
  });

  it('rejects invalid function paths', () => {
    expect(FUNCTION_PATH_PATTERN.test('')).toBe(false);
    expect(FUNCTION_PATH_PATTERN.test('noColon')).toBe(false);
    expect(FUNCTION_PATH_PATTERN.test(':noModule')).toBe(false);
    expect(FUNCTION_PATH_PATTERN.test('has spaces:fn')).toBe(false);
    expect(FUNCTION_PATH_PATTERN.test('module:has spaces')).toBe(false);
    expect(FUNCTION_PATH_PATTERN.test('module:')).toBe(false);
  });
});

describe('parseConvexOutput', () => {
  it('parses valid JSON', () => {
    expect(parseConvexOutput('{"key":"value"}')).toEqual({ key: 'value' });
    expect(parseConvexOutput('[1,2,3]')).toEqual([1, 2, 3]);
    expect(parseConvexOutput('"hello"')).toBe('hello');
    expect(parseConvexOutput('42')).toBe(42);
    expect(parseConvexOutput('null')).toBe(null);
    expect(parseConvexOutput('true')).toBe(true);
  });

  it('extracts JSON from output with leading log lines', () => {
    const output = 'Some log line\nAnother log\n{"result":"ok"}';
    expect(parseConvexOutput(output)).toEqual({ result: 'ok' });
  });

  it('extracts JSON from multi-line output with noise', () => {
    const output = 'Deploying...\nDone.\n[1, 2, 3]';
    expect(parseConvexOutput(output)).toEqual([1, 2, 3]);
  });

  it('returns raw string when no JSON is found', () => {
    expect(parseConvexOutput('plain text output')).toBe('plain text output');
  });

  it('handles multi-line JSON after noise', () => {
    const output = 'log line\n{\n  "a": 1\n}';
    expect(parseConvexOutput(output)).toEqual({ a: 1 });
  });
});
