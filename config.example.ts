/**
 * Example project configuration for convex-e2e.
 *
 * Copy this file to your project's `cli-test/config.ts` and adjust:
 *   1. Role definitions and email mappings
 *   2. Convex function paths to match your project's directory structure
 *   3. The loadSuites function to load your test suites
 */

import { defineConfig } from './src/index';

// Define the roles available in your application.
// Each role maps to a test user email that must exist in your seed data.
type Role = 'admin' | 'editor' | 'viewer';

const config = defineConfig<Role>({
  // Display name used in CLI output and test reports.
  projectName: 'My Project',

  // Map each role to its test user's email address.
  // These users must be created by your seedBase / seedAll functions.
  roles: {
    admin: 'admin@my-project.test',
    editor: 'editor@my-project.test',
    viewer: 'viewer@my-project.test',
  },

  // The default role used for the suite-level context and ctx.asAdmin().
  defaultRole: 'admin',

  // Convex function paths in "module:functionName" format.
  // These must be internalAction / internalMutation / internalQuery
  // (called via `npx convex run`).
  convexFunctions: {
    // internalAction: (email: string) => { userId, token }
    createSession: 'testSupport/auth:createTestSession',

    // internalAction: seeds core data (users, roles, settings)
    seedBase: 'testData/seed:seedBase',

    // internalAction: seeds all fixture data
    seedAll: 'testData/seed:seedAll',

    // internalAction: drops all test data
    clearAll: 'testData/seed:clearAll',

    // internalQuery: () => Record<string, string>
    getSeedIdMap: 'testSupport/inspect:getSeedIdMap',

    // internalMutation: (ids: Array<{table, id}>) => { deleted }
    deleteTracked: 'testSupport/cleanup:deleteDocuments',

    // internalQuery: (table, limit?) => Document[]
    listRecords: 'testSupport/inspect:listRecords',
  },

  // Load all test suites for the project.
  // Import and return them from a central tests/index.ts barrel file.
  loadSuites: () => {
    // Replace with your actual suite loader:
    // import { loadAllSuites } from './tests';
    // return loadAllSuites();
    return [];
  },

  // Optional: additional .env files to load (resolved from project root).
  // Defaults to ['.env.local', '.env', '.env.test'].
  // envFiles: ['.env.local', '.env'],
});

export default config;
