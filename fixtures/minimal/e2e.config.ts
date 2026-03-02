import { defineConfig } from '@amadeni/convex-e2e';
import { suites } from './suites';

type Role = 'admin';

export const config = defineConfig<Role>({
  projectName: 'Minimal Fixture',

  roles: {
    admin: 'admin@fixture.test',
  },

  defaultRole: 'admin',

  convexFunctions: {
    createSession: 'testSupport:createTestSession',
    seedBase: 'testSupport:seedBase',
    seedAll: 'testSupport:seedAll',
    clearAll: 'testSupport:clearAll',
    getSeedIdMap: 'testSupport:getSeedIdMap',
    deleteTracked: 'testSupport:deleteTracked',
    listRecords: 'testSupport:listRecords',
  },

  loadSuites: () => suites,
});
