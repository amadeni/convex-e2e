import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('getConvexUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.VITE_CONVEX_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns override when provided', async () => {
    const { getConvexUrl } = await import('../src/client');
    expect(getConvexUrl('https://override.convex.cloud')).toBe(
      'https://override.convex.cloud',
    );
  });

  it('reads CONVEX_URL from env', async () => {
    process.env.CONVEX_URL = 'https://env.convex.cloud';
    const { getConvexUrl } = await import('../src/client');
    expect(getConvexUrl()).toBe('https://env.convex.cloud');
  });

  it('reads NEXT_PUBLIC_CONVEX_URL as fallback', async () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://next.convex.cloud';
    const { getConvexUrl } = await import('../src/client');
    expect(getConvexUrl()).toBe('https://next.convex.cloud');
  });

  it('throws when no URL is available', async () => {
    const { getConvexUrl } = await import('../src/client');
    expect(() => getConvexUrl()).toThrow('No Convex URL found');
  });
});
