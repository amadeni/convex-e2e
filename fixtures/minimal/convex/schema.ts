import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  items: defineTable({
    title: v.string(),
    status: v.string(),
  }),

  appSettings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index('by_key', ['key']),
});
