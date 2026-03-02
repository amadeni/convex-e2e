import { ConvexHttpClient } from 'convex/browser';
import { convexRun } from './convex-run';
import { createClient } from './client';
import type { ConvexE2EConfig, TestAuthManager } from './types';

interface AuthResult {
  userId: string;
  token: string;
}

/**
 * Manages authentication tokens for test users.
 * Uses Convex internal actions to create sessions and generate JWTs.
 * Roles and function paths are driven by the project config.
 */
export class TestAuthManagerImpl<R extends string = string>
  implements TestAuthManager<R>
{
  private authResults: Map<R, AuthResult> = new Map();
  private deploymentUrl?: string;
  private roleEmailMap: Record<R, string>;
  private sessionFunctionPath: string;

  constructor(config: ConvexE2EConfig<R>, deploymentUrl?: string) {
    this.deploymentUrl = deploymentUrl;
    this.roleEmailMap = config.roles;
    this.sessionFunctionPath = config.convexFunctions.createSession;
  }

  async getTokenForRole(role: R): Promise<string> {
    const existing = this.authResults.get(role);
    if (existing) {
      return existing.token;
    }

    const email = this.roleEmailMap[role];
    if (!email) {
      throw new Error(`Unknown role: ${String(role)}`);
    }

    const result = convexRun(this.sessionFunctionPath, {
      email,
    }) as AuthResult;

    this.authResults.set(role, result);
    return result.token;
  }

  getUserIdForRole(role: R): string | undefined {
    return this.authResults.get(role)?.userId;
  }

  /**
   * Create an authenticated client for a given role.
   */
  async createClientForRole(role: R): Promise<ConvexHttpClient> {
    const token = await this.getTokenForRole(role);
    const client = createClient(this.deploymentUrl);
    client.setAuth(token);
    return client;
  }

  clearCache(): void {
    this.authResults.clear();
  }

  /**
   * Initialize tokens for all roles upfront.
   */
  async initializeAll(): Promise<void> {
    const roles = Object.keys(this.roleEmailMap) as R[];
    for (const role of roles) {
      await this.getTokenForRole(role);
    }
  }
}
