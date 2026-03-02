/**
 * Reusable inspect/support utilities for Convex e2e tests.
 *
 * Copy this file into your project's `convex/testSupport/` directory and adapt
 * the imports. The functions below provide:
 *
 * - getSeedIdMap / storeSeedIdMap: persist/retrieve the symbolic-ID-to-real-ID
 *   mapping in an `appSettings` table (or similar key-value table)
 * - countRecords / listRecords: generic table inspection for debugging
 *
 * Prerequisites:
 * - Your schema needs a key-value table (e.g. `appSettings`) with at least
 *   `key: string`, `value: string`, and an index `by_key` on `key`.
 */

// ---- Template: Convex queries / mutations (adapt imports) ----
//
// ```typescript
// import { internalMutation, internalQuery } from '../_generated/server';
// import { TableNames } from '../_generated/dataModel';
// import { v } from 'convex/values';
//
// const SEED_MAP_KEY = 'test_seed_id_map';
//
// export const getSeedIdMap = internalQuery({
//   args: {},
//   handler: async ctx => {
//     const setting = await ctx.db
//       .query('appSettings')
//       .withIndex('by_key', q => q.eq('key', SEED_MAP_KEY))
//       .first();
//     if (!setting) return {};
//     return JSON.parse(setting.value) as Record<string, string>;
//   },
// });
//
// export const storeSeedIdMap = internalMutation({
//   args: { idMap: v.string() },
//   handler: async (ctx, args) => {
//     const existing = await ctx.db
//       .query('appSettings')
//       .withIndex('by_key', q => q.eq('key', SEED_MAP_KEY))
//       .first();
//     if (existing) {
//       await ctx.db.patch(existing._id, {
//         value: args.idMap,
//         updatedAt: Date.now(),
//       });
//     } else {
//       await ctx.db.insert('appSettings', {
//         key: SEED_MAP_KEY,
//         value: args.idMap,
//       });
//     }
//   },
// });
//
// export const countRecords = internalQuery({
//   args: { table: v.string() },
//   handler: async (ctx, args) => {
//     const tableName = args.table as TableNames;
//     const docs = await ctx.db.query(tableName as any).collect();
//     return docs.length;
//   },
// });
//
// export const listRecords = internalQuery({
//   args: { table: v.string(), limit: v.optional(v.number()) },
//   handler: async (ctx, args) => {
//     const tableName = args.table as TableNames;
//     const max = args.limit ?? 20;
//     const docs = await ctx.db.query(tableName as any).take(max);
//     return docs;
//   },
// });
// ```
