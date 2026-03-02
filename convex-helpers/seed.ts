/**
 * Reusable seed utilities for Convex e2e tests.
 *
 * Copy this file into your project's `convex/testData/` directory and adapt
 * the imports to match your generated types. The functions below provide:
 *
 * - resolveRefs: resolves symbolic references (@@key) to real Convex IDs
 * - insertBatch: generic mutation to insert records into any table
 * - clearTable: generic mutation to delete all records from a table
 * - seedAll / seedBase / clearAll: orchestration actions
 *
 * Your project needs to supply:
 * - `seedOrder` / `baseSeedOrder` / `clearOrder` from a data file
 * - `storeSeedIdMap` mutation from an inspect/support module
 */

// ---- Pure utility (can be imported from anywhere) ----

/**
 * Resolves symbolic references (@@-prefixed strings) in a record to real IDs.
 * This is a pure function with no Convex dependencies.
 */
export function resolveRefs(
  obj: unknown,
  idMap: Record<string, string>,
): unknown {
  if (typeof obj === 'string' && obj.startsWith('@@')) {
    const resolved = idMap[obj];
    if (!resolved) {
      throw new Error(`Unresolved symbolic reference: ${obj}`);
    }
    return resolved;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => resolveRefs(item, idMap));
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveRefs(value, idMap);
    }
    return result;
  }
  return obj;
}

// ---- Template: Convex mutations / actions (adapt imports) ----
//
// Below is reference code showing how to wire up insertBatch, clearTable,
// seedAll, seedBase, and clearAll in your project. Copy and adapt the
// import paths to match your project's generated types.
//
// ```typescript
// import { internalAction, internalMutation } from '../_generated/server';
// import { internal } from '../_generated/api';
// import { TableNames } from '../_generated/dataModel';
// import { resolveRefs } from './seed-utils'; // or inline it
// import { seedOrder, baseSeedOrder, clearOrder } from './data';
//
// export const insertBatch = internalMutation({
//   handler: async (ctx, args: {
//     table: string;
//     records: Array<Record<string, unknown>>;
//     idMap: Record<string, string>;
//   }) => {
//     const newIdMap: Record<string, string> = { ...args.idMap };
//     const tableName = args.table as TableNames;
//     for (const record of args.records) {
//       const { _symId, ...fields } = record;
//       const resolved = resolveRefs(fields, newIdMap) as Record<string, never>;
//       const id = await ctx.db.insert(tableName, resolved as any);
//       if (typeof _symId === 'string') {
//         newIdMap[_symId] = id;
//       }
//     }
//     return newIdMap;
//   },
// });
//
// export const clearTable = internalMutation({
//   handler: async (ctx, args: { table: string }) => {
//     const tableName = args.table as TableNames;
//     const docs = await ctx.db.query(tableName as any).collect();
//     for (const doc of docs) { await ctx.db.delete(doc._id); }
//     return docs.length;
//   },
// });
//
// export const seedAll = internalAction({ ... });
// export const seedBase = internalAction({ ... });
// export const clearAll = internalAction({ ... });
// ```
