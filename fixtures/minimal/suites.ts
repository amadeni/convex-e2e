import {
  assertDefined,
  assertMinLength,
  type TestSuite,
} from '@amadeni/convex-e2e';
import { api } from './convex/_generated/api';

type Role = 'admin';

const itemsSuite: TestSuite<Role> = {
  name: 'items',
  tests: [
    {
      name: 'seed data exists',
      run: async ctx => {
        const items = await ctx.client.query(api.items.list);
        assertDefined(items, 'items query returned null');
        assertMinLength(items, 2, 'expected at least 2 seeded items');
      },
    },
    {
      name: 'seed IDs are mapped',
      run: async ctx => {
        assertDefined(ctx.seedData['@@item1'], 'seed ID @@item1 not found');
        assertDefined(ctx.seedData['@@item2'], 'seed ID @@item2 not found');
      },
    },
    {
      name: 'can create item via public API',
      run: async ctx => {
        const id = await ctx.client.mutation(api.items.create, {
          title: 'Test item',
          status: 'active',
        });
        assertDefined(id, 'create mutation returned null');
        ctx.track('items', id);

        const items = await ctx.client.query(api.items.list);
        const found = items.find(
          (i: { title: string }) => i.title === 'Test item',
        );
        assertDefined(found, 'created item not found in list');
      },
    },
  ],
};

export const suites: TestSuite<Role>[] = [itemsSuite];
