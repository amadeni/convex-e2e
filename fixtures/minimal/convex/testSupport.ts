import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

const SEED_MAP_KEY = 'test_seed_id_map';

const SEED_ITEMS = [
  { title: 'First item', status: 'active', _symId: '@@item1' },
  { title: 'Second item', status: 'done', _symId: '@@item2' },
];

// ── Seeding ─────────────────────────────────────────────────────────────────

export const seedBase = internalAction({
  args: {},
  handler: async ctx => {
    await ctx.runMutation(internal.testSupport.clearAllData);
    const idMap: Record<string, string> = {};

    for (const item of SEED_ITEMS) {
      const { _symId, ...fields } = item;
      const id: string = await ctx.runMutation(
        internal.testSupport.insertItem,
        fields,
      );
      idMap[_symId] = id;
    }

    await ctx.runMutation(internal.testSupport.storeSeedIdMap, {
      idMap: JSON.stringify(idMap),
    });
    return idMap;
  },
});

export const seedAll = internalAction({
  args: {},
  handler: async ctx => {
    return ctx.runAction(internal.testSupport.seedBase);
  },
});

export const clearAll = internalAction({
  args: {},
  handler: async ctx => {
    await ctx.runMutation(internal.testSupport.clearAllData);
    return { cleared: true };
  },
});

// ── Queries ─────────────────────────────────────────────────────────────────

export const getSeedIdMap = internalQuery({
  args: {},
  handler: async ctx => {
    const setting = await ctx.db
      .query('appSettings')
      .withIndex('by_key', q => q.eq('key', SEED_MAP_KEY))
      .first();
    if (!setting) return {};
    return JSON.parse(setting.value) as Record<string, string>;
  },
});

export const listRecords = internalQuery({
  args: { table: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const max = args.limit ?? 20;
    if (args.table === 'items') {
      return ctx.db.query('items').take(max);
    }
    if (args.table === 'appSettings') {
      return ctx.db.query('appSettings').take(max);
    }
    return [];
  },
});

// ── Mutations ───────────────────────────────────────────────────────────────

export const deleteTracked = internalMutation({
  args: {
    ids: v.array(v.object({ table: v.string(), id: v.string() })),
  },
  handler: async (ctx, args) => {
    let deleted = 0;
    for (const { id } of args.ids) {
      try {
        await ctx.db.delete(id as never);
        deleted++;
      } catch {
        // Document may already be deleted
      }
    }
    return { deleted };
  },
});

export const insertItem = internalMutation({
  args: { title: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    return ctx.db.insert('items', args);
  },
});

export const storeSeedIdMap = internalMutation({
  args: { idMap: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('appSettings')
      .withIndex('by_key', q => q.eq('key', SEED_MAP_KEY))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.idMap });
    } else {
      await ctx.db.insert('appSettings', {
        key: SEED_MAP_KEY,
        value: args.idMap,
      });
    }
  },
});

export const clearAllData = internalMutation({
  args: {},
  handler: async ctx => {
    const items = await ctx.db.query('items').collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    const settings = await ctx.db.query('appSettings').collect();
    for (const setting of settings) {
      await ctx.db.delete(setting._id);
    }
  },
});
