import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Main agents table
export const agentsTable = pgTable('agents', {
  // Primary key
  id: uuid('id').primaryKey().defaultRandom(),

  // Core agent data
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  prompt: text('prompt').notNull(),
  tools: jsonb('tools').$type<string[]>().default([]).notNull(),

  // Forking
  parentAgentId: uuid('parent_agent_id'),

  // Sharing
  shareId: varchar('share_id', { length: 50 }).unique(),
  isPublic: boolean('is_public').default(false).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Define relationships
export const agentsRelations = relations(agentsTable, ({ one, many }) => ({
  // Parent relation - An agent can be forked from only parent agent
  parent: one(agentsTable, {
    fields: [agentsTable.parentAgentId],
    references: [agentsTable.id],
    relationName: 'parentChild',
  }),

  // Children relation (agents forked from this one)
  forks: many(agentsTable, {
    relationName: 'parentChild',
  }),
}));

// Type exports for TypeScript
export type Agent = typeof agentsTable.$inferSelect;
export type NewAgent = typeof agentsTable.$inferInsert;
