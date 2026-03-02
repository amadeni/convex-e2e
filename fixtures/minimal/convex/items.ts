import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: {},
  handler: async ctx => {
    return ctx.db.query('items').collect();
  },
});

export const create = mutation({
  args: { title: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    return ctx.db.insert('items', args);
  },
});
