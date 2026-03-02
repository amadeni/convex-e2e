import { ConvexHttpClient } from 'convex/browser';

let defaultUrl: string | undefined;

/**
 * Get the Convex deployment URL from environment or CLI options.
 */
export function getConvexUrl(override?: string): string {
  if (override) return override;
  if (defaultUrl) return defaultUrl;

  const url =
    process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    process.env.VITE_CONVEX_URL;

  if (!url) {
    throw new Error(
      'No Convex URL found. Set CONVEX_URL environment variable or use --deployment flag.',
    );
  }

  defaultUrl = url;
  return url;
}

/**
 * Create a new ConvexHttpClient for the deployment.
 */
export function createClient(deploymentUrl?: string): ConvexHttpClient {
  const url = getConvexUrl(deploymentUrl);
  return new ConvexHttpClient(url, { logger: false });
}

/**
 * Create an authenticated ConvexHttpClient with a token.
 */
export function createAuthenticatedClient(
  token: string,
  deploymentUrl?: string,
): ConvexHttpClient {
  const client = createClient(deploymentUrl);
  client.setAuth(token);
  return client;
}
