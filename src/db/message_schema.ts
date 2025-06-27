// db/componentIntegratorSchema.ts - Component Integrator specific tables
import { pgTable, uuid, text, integer, timestamp, boolean, varchar, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Message summaries table for component integrator
export const messageSummaries = pgTable('ci_message_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  summary: text('summary').notNull(),
  messageCount: integer('message_count').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  keyTopics: text('key_topics').array(), // PostgreSQL array
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  createdAtIdx: index('idx_ci_summaries_created_at').on(table.createdAt),
}));

// Enhanced messages table for component integrator
export const ciMessages = pgTable('ci_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  messageType: varchar('message_type', { length: 20 }).notNull().$type<'user' | 'assistant' | 'system'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  
  // Metadata for file modifications
  fileModifications: text('file_modifications').array(),
  modificationApproach: varchar('modification_approach', { length: 20 }).$type<'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION'>(),
  modificationSuccess: boolean('modification_success'),
  
  // Enhanced reasoning and context fields
  reasoning: text('reasoning'), // Claude's reasoning for decisions
  selectedFiles: text('selected_files').array(), // Files that were selected
  errorDetails: text('error_details'), // Detailed error information
  stepType: varchar('step_type', { length: 50 }).$type<'analysis' | 'modification' | 'result' | 'fallback' | 'user_request'>(),
  
  // Modification details
  modificationRanges: text('modification_ranges'), // JSON string of modification ranges 
  
  // Reference to project summary (if applicable)
  projectSummaryId: uuid('project_summary_id').references(() => projectSummaries.id),
}, (table) => ({
  createdAtIdx: index('idx_ci_messages_created_at').on(table.createdAt.desc()),
  stepTypeIdx: index('idx_ci_messages_step_type').on(table.stepType),
  projectSummaryIdIdx: index('idx_ci_messages_project_summary_id').on(table.projectSummaryId),
}));

// Conversation stats table (single row) for component integrator
export const conversationStats = pgTable('ci_conversation_stats', {
  id: integer('id').primaryKey().default(1),
  totalMessageCount: integer('total_message_count').default(0),
  summaryCount: integer('summary_count').default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  lastModificationAt: timestamp('last_modification_at', { withTimezone: true }),
  totalModifications: integer('total_modifications').default(0),
  successfulModifications: integer('successful_modifications').default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Project summaries table for component integrator
export const projectSummaries = pgTable('ci_project_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  summary: text('summary').notNull(), // The detailed project summary
  originalPrompt: text('original_prompt').notNull(), // The prompt that generated this summary
  isActive: boolean('is_active').default(true), // Is this the active summary for the project
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow(), // When was this summary last used
}, (table) => ({
  createdAtIdx: index('idx_ci_project_summaries_created_at').on(table.createdAt),
  isActiveIdx: index('idx_ci_project_summaries_is_active').on(table.isActive),
}));

// Types for component integrator
export type CIMessage = typeof ciMessages.$inferSelect;
export type NewCIMessage = typeof ciMessages.$inferInsert;
export type MessageSummary = typeof messageSummaries.$inferSelect;
export type NewMessageSummary = typeof messageSummaries.$inferInsert;
export type ConversationStats = typeof conversationStats.$inferSelect;
export type ProjectSummary = typeof projectSummaries.$inferSelect;
export type NewProjectSummary = typeof projectSummaries.$inferInsert;

// Enhanced type for modification details
export interface ModificationDetails {
  file: string;
  range: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    originalCode: string;
  };
  modifiedCode: string;
}